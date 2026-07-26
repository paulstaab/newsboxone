//! AI-generated RSS and Atom recommendation API handlers.
//!
//! Recommendations are intentionally generated on demand and are not persisted. The LLM may suggest
//! direct feed URLs or site URLs, but every candidate is fetched through the existing SSRF-safe paths
//! and parsed as RSS/Atom before it is returned to the user.

use std::collections::HashSet;

use axum::Json;
use axum::extract::State;
use feed_rs::model::Feed;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, SqlitePool};

use crate::article_store;
use crate::config::Config;
use crate::feed_ingestion::{self, FeedFetchParseError, NINETY_DAYS};
use crate::llm::{self, LlmRequestContext};
use crate::ssrf;

use super::AppState;
use super::errors::{ApiResult, bad_request_error, internal_error};
use super::feeds;

const MIN_CONTEXT_FEEDS: usize = 5;
const MAX_CONTEXT_FEEDS: usize = 50;
const RECENT_TITLES_PER_FEED: usize = 5;
const DEFAULT_RECOMMENDATION_LIMIT: usize = 10;
const MAX_RECOMMENDATION_LIMIT: usize = 10;
const MAX_LLM_CANDIDATES: usize = 24;
const MAX_CONCURRENT_VERIFICATIONS: usize = 6;
const RECOMMENDATIONS_SCHEMA_NAME: &str = "feed_recommendations";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RecommendFeedsIn {
    limit: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RecommendedFeedOut {
    title: String,
    url: String,
    site_url: Option<String>,
    reason: String,
    topics: Vec<String>,
    latest_article_date: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RecommendFeedsOut {
    feeds: Vec<RecommendedFeedOut>,
    reason: Option<String>,
    generated_at: Option<i64>,
}

#[derive(Debug, FromRow)]
struct RecommendationContextFeedRow {
    id: i64,
    url: String,
    title: Option<String>,
    link: Option<String>,
    folder_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LlmContextFeed {
    title: String,
    domain: String,
    folder_name: Option<String>,
    recent_article_titles: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct RawRecommendationResponse {
    recommendations: Vec<RawRecommendationCandidate>,
}

#[derive(Debug, Deserialize)]
struct RawRecommendationCandidate {
    title: Option<String>,
    url: Option<String>,
    reason: Option<String>,
    topics: Option<Vec<String>>,
}

struct VerifiedCandidate {
    title: String,
    url: String,
    site_url: Option<String>,
    reason: String,
    topics: Vec<String>,
    latest_article_date: Option<i64>,
}

/// Generates on-demand feed recommendations from the user's current RSS subscriptions.
pub(super) async fn recommend_feeds(
    State(state): State<AppState>,
    input: Option<Json<RecommendFeedsIn>>,
) -> ApiResult<Json<RecommendFeedsOut>> {
    let limit = input
        .map(|Json(input)| input.limit.unwrap_or(DEFAULT_RECOMMENDATION_LIMIT))
        .unwrap_or(DEFAULT_RECOMMENDATION_LIMIT);
    if !(1..=MAX_RECOMMENDATION_LIMIT).contains(&limit) {
        return Err(bad_request_error(format!(
            "limit must be between 1 and {MAX_RECOMMENDATION_LIMIT}"
        )));
    }

    let result = recommend_feeds_impl(&state.pool, &state.config, limit).await?;
    Ok(Json(result))
}

async fn recommend_feeds_impl(
    pool: &SqlitePool,
    config: &Config,
    limit: usize,
) -> ApiResult<RecommendFeedsOut> {
    if !config.llm_enabled() {
        return Ok(empty_response("AI recommendations are not configured."));
    }

    let context_rows = load_recommendation_context_rows(pool).await?;
    if context_rows.len() < MIN_CONTEXT_FEEDS {
        return Ok(empty_response(format!(
            "Add at least {MIN_CONTEXT_FEEDS} RSS feeds before generating recommendations."
        )));
    }

    let subscribed_urls = context_rows
        .iter()
        .map(|feed| feed.url.clone())
        .collect::<HashSet<_>>();
    let context_feeds = build_llm_context(pool, context_rows).await?;
    let payload = build_openai_recommendations_payload(&config.openai_model, &context_feeds, limit);
    let Some(response_text) = llm::request_chat_completion_content(
        config,
        payload,
        LlmRequestContext {
            task_name: "feed-recommendations",
            feed_id: None,
            article_id: None,
        },
    )
    .await
    else {
        return Err((
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": "Unable to generate feed recommendations." })),
        ));
    };

    let raw = parse_llm_recommendations(&response_text).ok_or_else(|| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": "Unable to parse feed recommendations." })),
        )
    })?;
    let candidate_count = raw.recommendations.len().min(MAX_LLM_CANDIDATES);
    tracing::info!(
        task_name = "feed-recommendations",
        candidate_count,
        returned_candidate_count = raw.recommendations.len(),
        max_candidate_count = MAX_LLM_CANDIDATES,
        "LLM recommendation candidates parsed"
    );

    let mut verification_tasks = tokio::task::JoinSet::new();
    let mut verified = Vec::new();
    let mut seen_urls = subscribed_urls.clone();
    tracing::info!(
        task_name = "feed-recommendations",
        candidate_count,
        max_concurrency = MAX_CONCURRENT_VERIFICATIONS,
        "starting recommendation candidate verification"
    );
    for candidate in raw.recommendations.into_iter().take(MAX_LLM_CANDIDATES) {
        let Some(candidate_url) = candidate.url.as_deref().and_then(clean_string) else {
            continue;
        };
        if is_excluded_source(&candidate_url) {
            continue;
        }
        let reason = candidate
            .reason
            .as_deref()
            .and_then(clean_string)
            .unwrap_or_else(|| "Matches your current reading topics.".to_string());
        let topics = candidate
            .topics
            .unwrap_or_default()
            .into_iter()
            .filter_map(|topic| clean_string(&topic))
            .take(5)
            .collect::<Vec<_>>();
        let title_hint = candidate.title.as_deref().and_then(clean_string);
        let subscribed_urls = subscribed_urls.clone();
        let testing_mode = config.testing_mode;

        verification_tasks.spawn(async move {
            verify_candidate_url(
                &candidate_url,
                title_hint.as_deref(),
                &reason,
                &topics,
                &subscribed_urls,
                testing_mode,
            )
            .await
        });

        if verification_tasks.len() >= MAX_CONCURRENT_VERIFICATIONS
            && let Some(Ok(Some(candidate))) = verification_tasks.join_next().await
            && seen_urls.insert(candidate.url.clone())
        {
            verified.push(candidate);
        }
    }

    while let Some(result) = verification_tasks.join_next().await {
        let Ok(Some(candidate)) = result else {
            continue;
        };
        if seen_urls.insert(candidate.url.clone()) {
            verified.push(candidate);
        }
    }

    tracing::info!(
        task_name = "feed-recommendations",
        candidate_count,
        validated_candidate_count = verified.len(),
        "recommendation candidate verification completed"
    );

    verified.sort_by(|left, right| {
        right
            .latest_article_date
            .cmp(&left.latest_article_date)
            .then_with(|| left.title.to_lowercase().cmp(&right.title.to_lowercase()))
    });

    let feeds = verified
        .into_iter()
        .take(limit)
        .map(|candidate| RecommendedFeedOut {
            title: candidate.title,
            url: candidate.url,
            site_url: candidate.site_url,
            reason: candidate.reason,
            topics: candidate.topics,
            latest_article_date: candidate.latest_article_date,
        })
        .collect::<Vec<_>>();
    let reason = if feeds.is_empty() {
        Some("No active RSS or Atom recommendations were found.".to_string())
    } else {
        None
    };

    Ok(RecommendFeedsOut {
        feeds,
        reason,
        generated_at: Some(article_store::unix_now()),
    })
}

fn empty_response(reason: impl Into<String>) -> RecommendFeedsOut {
    RecommendFeedsOut {
        feeds: Vec::new(),
        reason: Some(reason.into()),
        generated_at: None,
    }
}

async fn load_recommendation_context_rows(
    pool: &SqlitePool,
) -> ApiResult<Vec<RecommendationContextFeedRow>> {
    sqlx::query_as::<_, RecommendationContextFeedRow>(
        "SELECT feed.id, feed.url, feed.title, feed.link, folder.name AS folder_name \
         FROM feed LEFT JOIN folder ON folder.id = feed.folder_id AND folder.is_root = 0 \
         WHERE feed.deleted_at IS NULL AND feed.is_mailing_list = 0 \
         ORDER BY COALESCE(feed.last_article_date, feed.added) DESC, feed.id DESC \
         LIMIT ?",
    )
    .bind(MAX_CONTEXT_FEEDS as i64)
    .fetch_all(pool)
    .await
    .map_err(internal_error)
}

async fn build_llm_context(
    pool: &SqlitePool,
    feeds: Vec<RecommendationContextFeedRow>,
) -> ApiResult<Vec<LlmContextFeed>> {
    let mut context = Vec::new();

    for feed in feeds {
        let domain = feed
            .link
            .as_deref()
            .and_then(extract_domain)
            .or_else(|| extract_domain(&feed.url))
            .unwrap_or_else(|| "unknown".to_string());
        let titles = load_recent_article_titles(pool, feed.id).await?;
        context.push(LlmContextFeed {
            title: feed.title.unwrap_or_else(|| domain.clone()),
            domain,
            folder_name: feed.folder_name,
            recent_article_titles: titles,
        });
    }

    Ok(context)
}

async fn load_recent_article_titles(pool: &SqlitePool, feed_id: i64) -> ApiResult<Vec<String>> {
    let titles = sqlx::query_scalar::<_, Option<String>>(
        "SELECT title FROM article WHERE feed_id = ? AND title IS NOT NULL \
         ORDER BY COALESCE(pub_date, updated_date, last_modified) DESC, id DESC LIMIT ?",
    )
    .bind(feed_id)
    .bind(RECENT_TITLES_PER_FEED as i64)
    .fetch_all(pool)
    .await
    .map_err(internal_error)?;

    Ok(titles
        .into_iter()
        .flatten()
        .filter_map(|title| clean_string(&title))
        .collect())
}

fn build_openai_recommendations_payload(
    model: &str,
    feeds: &[LlmContextFeed],
    limit: usize,
) -> serde_json::Value {
    json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You recommend active website, news, and blog RSS/Atom feeds for a self-hosted RSS reader. Infer topics and dominant language from the provided subscriptions. Balance mainstream and specialized sources. Avoid YouTube, Reddit, podcast, social-network, newsletter-only, and dead feeds. Return candidate direct feed URLs or source site URLs; the server will verify RSS/Atom availability. Return exactly one JSON object with a top-level recommendations array."
            },
            {
                "role": "user",
                "content": serde_json::to_string_pretty(&json!({
                    "maxRecommendations": limit,
                    "currentSubscriptions": feeds,
                    "constraints": [
                        "Use only feed titles, source domains, folder names, and recent article titles provided here.",
                        "Do not recommend exact current subscriptions.",
                        "Prefer feeds likely to have published within the last 90 days.",
                        "Keep reasons short and user-facing."
                    ]
                })).unwrap_or_else(|_| "{}".to_string())
            }
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": RECOMMENDATIONS_SCHEMA_NAME,
                "strict": true,
                "schema": {
                    "type": "object",
                    "properties": {
                        "recommendations": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": ["string", "null"]},
                                    "url": {"type": ["string", "null"]},
                                    "reason": {"type": ["string", "null"]},
                                    "topics": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                },
                                "required": ["title", "url", "reason", "topics"],
                                "additionalProperties": false
                            }
                        }
                    },
                    "required": ["recommendations"],
                    "additionalProperties": false
                }
            }
        }
    })
}

fn parse_llm_recommendations(response_text: &str) -> Option<RawRecommendationResponse> {
    let value = serde_json::from_str::<serde_json::Value>(response_text).ok()?;
    serde_json::from_value(value.clone()).ok().or_else(|| {
        value
            .get(RECOMMENDATIONS_SCHEMA_NAME)
            .cloned()
            .and_then(|wrapped| serde_json::from_value(wrapped).ok())
    })
}

async fn verify_candidate_url(
    candidate_url: &str,
    title_hint: Option<&str>,
    reason: &str,
    topics: &[String],
    seen_urls: &HashSet<String>,
    testing_mode: bool,
) -> Option<VerifiedCandidate> {
    if let Some(candidate) = verify_direct_feed_url(
        candidate_url,
        title_hint,
        None,
        reason,
        topics,
        seen_urls,
        testing_mode,
    )
    .await
    {
        return Some(candidate);
    }

    verify_site_url(
        candidate_url,
        title_hint,
        reason,
        topics,
        seen_urls,
        testing_mode,
    )
    .await
}

async fn verify_site_url(
    site_url: &str,
    title_hint: Option<&str>,
    reason: &str,
    topics: &[String],
    seen_urls: &HashSet<String>,
    testing_mode: bool,
) -> Option<VerifiedCandidate> {
    let response = ssrf::get_with_safe_redirects(
        crate::http_client::HttpClientProfile::Article,
        site_url,
        testing_mode,
    )
    .await
    .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let final_url = response.url().clone();
    let body = response.bytes().await.ok()?;
    let html = String::from_utf8_lossy(&body);
    for discovered in feeds::discover_embedded_feed_links(&html, &final_url) {
        let title_hint = discovered.title.as_deref().or(title_hint);
        if let Some(candidate) = verify_direct_feed_url(
            &discovered.url,
            title_hint,
            Some(final_url.as_str()),
            reason,
            topics,
            seen_urls,
            testing_mode,
        )
        .await
        {
            return Some(candidate);
        }
    }

    None
}

async fn verify_direct_feed_url(
    feed_url: &str,
    title_hint: Option<&str>,
    site_url: Option<&str>,
    reason: &str,
    topics: &[String],
    seen_urls: &HashSet<String>,
    testing_mode: bool,
) -> Option<VerifiedCandidate> {
    if seen_urls.contains(feed_url) || is_excluded_source(feed_url) {
        return None;
    }

    let parsed =
        match feed_ingestion::fetch_and_parse_feed_document_checked(feed_url, testing_mode).await {
            Ok(document) => document.feed,
            Err(FeedFetchParseError::SafeGet(_)) => return None,
            Err(_) => return None,
        };
    let latest_article_date = latest_feed_entry_timestamp(&parsed)?;
    if latest_article_date < article_store::unix_now() - NINETY_DAYS {
        return None;
    }

    let title = parsed
        .title
        .map(|title| title.content)
        .as_deref()
        .and_then(clean_string)
        .or_else(|| title_hint.and_then(clean_string))
        .or_else(|| extract_domain(feed_url))
        .unwrap_or_else(|| "Recommended feed".to_string());
    let site_url = site_url
        .map(str::to_string)
        .or_else(|| parsed.links.first().map(|link| link.href.clone()))
        .filter(|url| url != feed_url);

    Some(VerifiedCandidate {
        title,
        url: feed_url.to_string(),
        site_url,
        reason: reason.to_string(),
        topics: topics.to_vec(),
        latest_article_date: Some(latest_article_date),
    })
}

fn latest_feed_entry_timestamp(feed: &Feed) -> Option<i64> {
    feed.entries
        .iter()
        .filter_map(|entry| {
            entry
                .published
                .or(entry.updated)
                .map(|date| date.timestamp())
        })
        .max()
}

fn clean_string(value: &str) -> Option<String> {
    let normalized = whitespace_regex()
        .replace_all(value.trim(), " ")
        .to_string();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn extract_domain(url: &str) -> Option<String> {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
}

fn is_excluded_source(url: &str) -> bool {
    let Some(domain) = extract_domain(url).map(|domain| domain.to_ascii_lowercase()) else {
        return false;
    };
    [
        "youtube.com",
        "youtu.be",
        "reddit.com",
        "podcasts.apple.com",
        "open.spotify.com",
        "facebook.com",
        "x.com",
        "twitter.com",
        "instagram.com",
        "tiktok.com",
    ]
    .iter()
    .any(|blocked| domain == *blocked || domain.ends_with(&format!(".{blocked}")))
}

fn whitespace_regex() -> &'static Regex {
    static REGEX: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"\s+").expect("valid whitespace regex"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recommendations_payload_uses_model_default_temperature() {
        let payload = build_openai_recommendations_payload("test-model", &[], 10);

        assert!(payload.get("temperature").is_none());
    }

    #[test]
    fn parse_llm_recommendations_accepts_top_level_response() {
        let parsed = parse_llm_recommendations(
            r#"{"recommendations":[{"title":"Example","url":"https://example.com/feed.xml","reason":"Matches tech feeds.","topics":["tech"]}]}"#,
        )
        .expect("recommendations should parse");

        assert_eq!(parsed.recommendations.len(), 1);
        assert_eq!(
            parsed.recommendations[0].url.as_deref(),
            Some("https://example.com/feed.xml")
        );
    }

    #[test]
    fn clean_string_collapses_whitespace() {
        assert_eq!(clean_string("  A\n  B\tC  ").as_deref(), Some("A B C"));
        assert_eq!(clean_string("  "), None);
    }

    #[test]
    fn excluded_sources_cover_social_platforms() {
        assert!(is_excluded_source(
            "https://www.youtube.com/feeds/videos.xml"
        ));
        assert!(is_excluded_source("https://old.reddit.com/r/rss/.rss"));
        assert!(!is_excluded_source("https://example.com/feed.xml"));
    }
}
