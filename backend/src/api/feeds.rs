//! Feed handlers and feed-related article ingestion helpers.

use std::collections::HashSet;
use std::sync::OnceLock;

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::article_store;
use crate::config::Config;
use crate::content::FeedContentState;
use crate::feed_ingestion::{self, FeedEntryIngestionContext};
use crate::repo;
use crate::updater::{self, FeedQualityOverrideUpdate};

use super::AppState;
use super::errors::{
    ApiResult, anyhow_internal_error, bad_request_error, feed_already_exists,
    feed_not_found_with_id, feed_parse_error, internal_error, ssrf_error,
};
use super::folders::resolve_folder_id;

#[derive(FromRow)]
struct FeedRow {
    id: i64,
    url: String,
    title: Option<String>,
    favicon_link: Option<String>,
    added: i64,
    last_article_date: Option<i64>,
    next_update_time: Option<i64>,
    folder_id: i64,
    ordering: i64,
    link: Option<String>,
    pinned: bool,
    update_error_count: i64,
    last_update_error: Option<String>,
    is_mailing_list: bool,
    last_quality_check: Option<i64>,
    use_extracted_fulltext: bool,
    use_llm_summary: bool,
    manual_use_extracted_fulltext: Option<bool>,
    manual_use_llm_summary: Option<bool>,
    last_manual_quality_override: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedOut {
    id: i64,
    url: String,
    title: Option<String>,
    favicon_link: Option<String>,
    added: i64,
    last_article_date: Option<i64>,
    next_update_time: Option<i64>,
    folder_id: Option<i64>,
    ordering: i64,
    link: Option<String>,
    pinned: bool,
    update_error_count: i64,
    last_update_error: Option<String>,
    r#type: String,
    last_quality_check: Option<i64>,
    use_extracted_fulltext: bool,
    use_llm_summary: bool,
    manual_use_extracted_fulltext: Option<bool>,
    manual_use_llm_summary: Option<bool>,
    last_manual_quality_override: Option<i64>,
}

#[derive(Serialize)]
pub(super) struct FeedGetOut {
    feeds: Vec<FeedOut>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedCreateIn {
    url: String,
    folder_id: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedCreateOut {
    feeds: Vec<FeedOut>,
    newest_item_id: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedDiscoverIn {
    url: String,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DiscoveredFeedOut {
    title: Option<String>,
    url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedDiscoverOut {
    feeds: Vec<DiscoveredFeedOut>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedMoveIn {
    pub(super) folder_id: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedRenameIn {
    pub(super) feed_title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct FeedQualityOut {
    feed: FeedOut,
}

/// Lists configured feeds and maps the internal root folder to `null`.
pub(super) async fn get_feeds(State(state): State<AppState>) -> ApiResult<Json<FeedGetOut>> {
    let feeds = load_feeds(&state.pool).await?;
    Ok(Json(FeedGetOut { feeds }))
}

/// Adds a feed through either supported Nextcloud API version.
pub(super) async fn add_feed(
    State(state): State<AppState>,
    Json(input): Json<FeedCreateIn>,
) -> ApiResult<Json<FeedCreateOut>> {
    add_feed_impl(
        &state.pool,
        &state.feed_http_client,
        &state.article_http_client,
        &state.config,
        input,
    )
    .await
}

/// Discovers RSS and Atom feeds advertised by a website's HTML metadata.
pub(super) async fn discover_feeds(
    State(state): State<AppState>,
    Json(input): Json<FeedDiscoverIn>,
) -> ApiResult<Json<FeedDiscoverOut>> {
    discover_feeds_impl(&input.url, state.config.testing_mode).await
}

/// Deletes a feed and all associated articles.
pub(super) async fn delete_feed(
    State(state): State<AppState>,
    Path(feed_id): Path<i64>,
) -> ApiResult<StatusCode> {
    if !repo::feed_exists(&state.pool, feed_id)
        .await
        .map_err(internal_error)?
    {
        return Err(feed_not_found_with_id(feed_id));
    }

    let counts = repo::delete_feed_cascade(&state.pool, feed_id)
        .await
        .map_err(internal_error)?;

    tracing::info!(
        feed_id,
        deleted_articles = counts.deleted_articles,
        deleted_feeds = counts.deleted_feeds,
        "feed/article cleanup completed"
    );

    Ok(StatusCode::OK)
}

/// Moves a feed to a different folder.
pub(super) async fn move_feed(
    State(state): State<AppState>,
    Path(feed_id): Path<i64>,
    Json(input): Json<FeedMoveIn>,
) -> ApiResult<StatusCode> {
    move_feed_impl(&state.pool, feed_id, input.folder_id).await
}

/// Renames a feed.
pub(super) async fn rename_feed(
    State(state): State<AppState>,
    Path(feed_id): Path<i64>,
    Json(input): Json<FeedRenameIn>,
) -> ApiResult<StatusCode> {
    rename_feed_impl(&state.pool, feed_id, &input.feed_title).await
}

/// Marks all feed items up to a boundary as read.
pub(super) async fn mark_feed_items_read(
    State(state): State<AppState>,
    Path(feed_id): Path<i64>,
    Json(input): Json<super::folders::MarkAllItemsReadIn>,
) -> ApiResult<StatusCode> {
    mark_feed_items_read_impl(&state.pool, feed_id, input.newest_item_id).await
}

/// Updates feed-quality overrides or forces re-evaluation for one feed.
pub(super) async fn update_feed_quality(
    State(state): State<AppState>,
    Path(feed_id): Path<i64>,
    Json(input): Json<serde_json::Value>,
) -> ApiResult<Json<FeedQualityOut>> {
    let object = input
        .as_object()
        .ok_or_else(|| bad_request_error("feed quality payload must be a JSON object"))?;
    for key in object.keys() {
        if !matches!(
            key.as_str(),
            "reevaluate" | "useExtractedFulltext" | "useLlmSummary"
        ) {
            return Err(bad_request_error(format!("unknown field: {key}")));
        }
    }
    let reevaluate = parse_reevaluate_field(object.get("reevaluate"))?;
    let use_extracted_fulltext =
        parse_quality_field(object.get("useExtractedFulltext"), "useExtractedFulltext")?;
    let use_llm_summary = parse_quality_field(object.get("useLlmSummary"), "useLlmSummary")?;

    if reevaluate {
        if use_extracted_fulltext.is_some() || use_llm_summary.is_some() {
            return Err(bad_request_error(
                "reevaluate cannot be combined with manual feed-quality fields",
            ));
        }

        updater::reevaluate_feed_quality_with_pool(
            &state.pool,
            &state.config,
            feed_id,
            state.config.testing_mode,
        )
        .await
        .map_err(map_feed_quality_error)?;
    } else {
        updater::update_feed_quality_overrides_with_pool(
            &state.pool,
            feed_id,
            FeedQualityOverrideUpdate {
                use_extracted_fulltext,
                use_llm_summary,
            },
        )
        .await
        .map_err(map_feed_quality_error)?;
    }

    let feed = load_feed(&state.pool, feed_id).await?;
    Ok(Json(FeedQualityOut { feed }))
}

/// Fetches a website page and extracts supported embedded feed links.
async fn discover_feeds_impl(url: &str, testing_mode: bool) -> ApiResult<Json<FeedDiscoverOut>> {
    let response = crate::ssrf::get_with_safe_redirects(
        crate::http_client::HttpClientProfile::Feed,
        url,
        testing_mode,
    )
    .await
    .map_err(|error| match error {
        crate::ssrf::SafeGetError::Validation(error) => ssrf_error(error),
        crate::ssrf::SafeGetError::Request(error) => feed_parse_error(error),
    })?;

    if !response.status().is_success() {
        return Err(feed_parse_error(format!(
            "Error discovering feeds from `{}`: HTTP {}",
            url,
            response.status()
        )));
    }

    let final_url = response.url().clone();
    let body = response.bytes().await.map_err(feed_parse_error)?;
    let html = String::from_utf8_lossy(&body);
    let feeds = discover_embedded_feed_links(&html, &final_url);

    Ok(Json(FeedDiscoverOut { feeds }))
}

/// Extracts RSS/Atom alternate links from an HTML document and resolves them against the page URL.
fn discover_embedded_feed_links(html: &str, page_url: &reqwest::Url) -> Vec<DiscoveredFeedOut> {
    let mut feeds = Vec::new();
    let mut seen_urls = HashSet::new();

    for link_match in link_tag_regex().find_iter(html) {
        let tag = link_match.as_str();
        let rel = html_attribute_value(tag, "rel").unwrap_or_default();
        if !rel
            .split_ascii_whitespace()
            .any(|token| token.eq_ignore_ascii_case("alternate"))
        {
            continue;
        }

        let feed_type = html_attribute_value(tag, "type").unwrap_or_default();
        if !is_supported_feed_type(&feed_type) {
            continue;
        }

        let Some(href) = html_attribute_value(tag, "href") else {
            continue;
        };
        let Ok(resolved_url) = page_url.join(href.trim()) else {
            continue;
        };
        let resolved_url = resolved_url.to_string();
        if !seen_urls.insert(resolved_url.clone()) {
            continue;
        }

        feeds.push(DiscoveredFeedOut {
            title: html_attribute_value(tag, "title").and_then(blank_to_none),
            url: resolved_url,
        });
    }

    feeds
}

fn is_supported_feed_type(value: &str) -> bool {
    let mime_type = value
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    matches!(
        mime_type.as_str(),
        "application/rss+xml" | "application/atom+xml"
    )
}

fn html_attribute_value(tag: &str, attribute_name: &str) -> Option<String> {
    for capture in html_attribute_regex().captures_iter(tag) {
        let name = capture.name("name")?.as_str();
        if !name.eq_ignore_ascii_case(attribute_name) {
            continue;
        }

        let value = capture
            .name("double")
            .or_else(|| capture.name("single"))
            .or_else(|| capture.name("bare"))?
            .as_str()
            .trim()
            .to_string();
        return Some(value);
    }

    None
}

fn blank_to_none(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

fn link_tag_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"(?is)<link\b[^>]*>").expect("valid link tag regex"))
}

fn html_attribute_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?is)\b(?P<name>[a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:\"(?P<double>[^\"]*)\"|'(?P<single>[^']*)'|(?P<bare>[^\s\"'=<>`]+))"#,
        )
        .expect("valid html attribute regex")
    })
}

fn normalize_feed_title(title: Option<String>) -> Option<String> {
    title.and_then(|value| {
        let normalized = whitespace_regex()
            .replace_all(value.trim(), " ")
            .to_string();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

fn extract_xml_feed_title(body: &[u8]) -> Option<String> {
    let document = String::from_utf8_lossy(body);
    let captures = xml_title_regex().captures(&document)?;
    let title = captures.name("title")?.as_str();
    normalize_feed_title(Some(decode_minimal_xml_entities(title)))
}

fn decode_minimal_xml_entities(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

fn xml_title_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?is)<(?:[A-Za-z_][\w.-]*:)?title\b[^>]*>(?P<title>.*?)</(?:[A-Za-z_][\w.-]*:)?title>")
            .expect("valid XML title regex")
    })
}

fn whitespace_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"\s+").expect("valid whitespace regex"))
}

/// Validates feed input, persists the feed row, and ingests the initial article set.
async fn add_feed_impl(
    pool: &SqlitePool,
    _feed_http_client: &reqwest::Client,
    article_http_client: &reqwest::Client,
    config: &Config,
    input: FeedCreateIn,
) -> ApiResult<Json<FeedCreateOut>> {
    let folder_id = resolve_folder_id(pool, input.folder_id).await?;

    let existing = repo::feed_exists_by_url(pool, &input.url)
        .await
        .map_err(internal_error)?;
    if existing {
        return Err(feed_already_exists());
    }

    let parsed_document =
        feed_ingestion::fetch_and_parse_feed_document_checked(&input.url, config.testing_mode)
            .await
            .map_err(|error| match error {
                feed_ingestion::FeedFetchParseError::SafeGet(safe_error) => match safe_error {
                    crate::ssrf::SafeGetError::Validation(error) => ssrf_error(error),
                    crate::ssrf::SafeGetError::Request(error) => feed_parse_error(error),
                },
                feed_ingestion::FeedFetchParseError::BadStatus(status) => feed_parse_error(
                    format!("Error parsing feed from `{}`: HTTP {}", input.url, status),
                ),
                feed_ingestion::FeedFetchParseError::Body(error) => feed_parse_error(error),
                feed_ingestion::FeedFetchParseError::Parse(error) => {
                    feed_parse_error(format!("Error parsing feed from `{}`: {error}", input.url))
                }
            })?;
    let parsed = parsed_document.feed;

    let now_ts = article_store::unix_now();
    let title = normalize_feed_title(parsed.title.map(|title| title.content))
        .or_else(|| extract_xml_feed_title(&parsed_document.body));
    let link = parsed.links.first().map(|l| l.href.clone());

    let result = sqlx::query(
        "INSERT INTO feed (url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error) VALUES (?, ?, NULL, ?, NULL, ?, ?, 0, ?, 0, 0, NULL)",
    )
    .bind(&input.url)
    .bind(title.as_deref())
    .bind(now_ts)
    .bind(now_ts + 86_400)
    .bind(folder_id)
    .bind(link)
    .execute(pool)
    .await
    .map_err(internal_error)?;
    let feed_id = result.last_insert_rowid();
    let content_state = FeedContentState {
        last_quality_check: None,
        use_extracted_fulltext: false,
        use_llm_summary: false,
        manual_use_extracted_fulltext: None,
        manual_use_llm_summary: None,
    };

    let context = FeedEntryIngestionContext {
        pool,
        article_http_client,
        config,
        feed_id,
        feed_url: &input.url,
        content_state,
    };
    let ingestion_stats = feed_ingestion::ingest_feed_entries(&context, &parsed.entries)
        .await
        .map_err(anyhow_internal_error)?;

    tracing::info!(
        feed_id,
        folder_id,
        articles_processed = ingestion_stats.processed,
        articles_inserted = ingestion_stats.inserted,
        articles_skipped = ingestion_stats.skipped(),
        "feed added"
    );

    let newest_item_id = repo::newest_article_id_for_feed(pool, feed_id)
        .await
        .map_err(internal_error)?;
    let feeds = load_feeds(pool).await?;
    Ok(Json(FeedCreateOut {
        feeds,
        newest_item_id,
    }))
}

/// Moves a feed to the requested folder after validating both identifiers.
async fn move_feed_impl(
    pool: &SqlitePool,
    feed_id: i64,
    folder_id: Option<i64>,
) -> ApiResult<StatusCode> {
    if !repo::feed_exists(pool, feed_id)
        .await
        .map_err(internal_error)?
    {
        return Err(feed_not_found_with_id(feed_id));
    }

    let resolved_folder_id = resolve_folder_id(pool, folder_id).await?;
    repo::move_feed(pool, feed_id, resolved_folder_id)
        .await
        .map_err(internal_error)?;

    Ok(StatusCode::OK)
}

/// Updates the stored display title for a single feed.
async fn rename_feed_impl(
    pool: &SqlitePool,
    feed_id: i64,
    feed_title: &str,
) -> ApiResult<StatusCode> {
    let affected = repo::rename_feed(pool, feed_id, feed_title)
        .await
        .map_err(internal_error)?;

    if affected == 0 {
        return Err(feed_not_found_with_id(feed_id));
    }
    Ok(StatusCode::OK)
}

/// Marks items in a single feed as read up to the provided newest item boundary.
async fn mark_feed_items_read_impl(
    pool: &SqlitePool,
    feed_id: i64,
    newest_item_id: i64,
) -> ApiResult<StatusCode> {
    if !repo::feed_exists(pool, feed_id)
        .await
        .map_err(internal_error)?
    {
        return Err(feed_not_found_with_id(feed_id));
    }

    repo::mark_feed_items_read(pool, feed_id, newest_item_id)
        .await
        .map_err(internal_error)?;

    Ok(StatusCode::OK)
}

/// Loads feeds in API response format.
/// Loads all feeds and normalizes the internal root folder to `null` in responses.
pub(super) async fn load_feeds(pool: &SqlitePool) -> ApiResult<Vec<FeedOut>> {
    let root_folder_id = load_root_folder_id(pool).await?;
    let rows = load_feed_rows(pool, None).await?;
    Ok(rows
        .into_iter()
        .map(|feed| map_feed_row(feed, root_folder_id))
        .collect())
}

/// Loads one feed in API response format.
async fn load_feed(pool: &SqlitePool, feed_id: i64) -> ApiResult<FeedOut> {
    let root_folder_id = load_root_folder_id(pool).await?;
    let mut rows = load_feed_rows(pool, Some(feed_id)).await?;
    let Some(feed) = rows.pop() else {
        return Err(feed_not_found_with_id(feed_id));
    };

    Ok(map_feed_row(feed, root_folder_id))
}

/// Loads the internal root folder identifier used for `null` normalization.
async fn load_root_folder_id(pool: &SqlitePool) -> ApiResult<Option<i64>> {
    let root_folder_id: Option<i64> =
        sqlx::query_scalar("SELECT id FROM folder WHERE is_root = 1 LIMIT 1")
            .fetch_optional(pool)
            .await
            .map_err(internal_error)?;

    Ok(root_folder_id)
}

/// Loads one or all feed rows with quality metadata included.
async fn load_feed_rows(pool: &SqlitePool, feed_id: Option<i64>) -> ApiResult<Vec<FeedRow>> {
    let rows = if let Some(feed_id) = feed_id {
        sqlx::query_as::<_, FeedRow>(
            "SELECT id, url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, is_mailing_list, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override FROM feed WHERE id = ? AND deleted_at IS NULL ORDER BY id",
        )
        .bind(feed_id)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, FeedRow>(
            "SELECT id, url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, is_mailing_list, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override FROM feed WHERE deleted_at IS NULL ORDER BY id",
        )
        .fetch_all(pool)
        .await
    }
    .map_err(internal_error)?;

    Ok(rows)
}

/// Maps a database feed row into the public API shape.
fn map_feed_row(feed: FeedRow, root_folder_id: Option<i64>) -> FeedOut {
    FeedOut {
        id: feed.id,
        url: feed.url,
        title: feed.title,
        favicon_link: feed.favicon_link,
        added: feed.added,
        last_article_date: feed.last_article_date,
        next_update_time: feed.next_update_time,
        folder_id: match root_folder_id {
            Some(root_id) if root_id == feed.folder_id => None,
            _ => Some(feed.folder_id),
        },
        ordering: feed.ordering,
        link: feed.link,
        pinned: feed.pinned,
        update_error_count: feed.update_error_count,
        last_update_error: feed.last_update_error,
        r#type: if feed.is_mailing_list {
            "mailingList".to_string()
        } else {
            "rss".to_string()
        },
        last_quality_check: feed.last_quality_check,
        use_extracted_fulltext: feed.use_extracted_fulltext,
        use_llm_summary: feed.use_llm_summary,
        manual_use_extracted_fulltext: feed.manual_use_extracted_fulltext,
        manual_use_llm_summary: feed.manual_use_llm_summary,
        last_manual_quality_override: feed.last_manual_quality_override,
    }
}

/// Maps updater-side feed-quality errors into public API errors.
fn map_feed_quality_error(error: anyhow::Error) -> super::errors::ApiError {
    let detail = error.to_string();

    // Feed not found: produced by `with_context(|| format!("feed {id} not found"))`.
    if let Some(feed_id) = detail
        .strip_prefix("feed ")
        .and_then(|rest| rest.split_whitespace().next())
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|_| detail.ends_with("not found"))
    {
        return feed_not_found_with_id(feed_id);
    }

    // Known validation errors from `anyhow::ensure!` in the updater.
    if detail == "at least one feed-quality attribute must be provided" {
        return bad_request_error(detail);
    }

    // Unexpected/internal errors: log and return a generic 500.
    anyhow_internal_error(error)
}

/// Parses one tri-state feed-quality field from JSON while preserving explicit `null`.
fn parse_quality_field(
    raw: Option<&serde_json::Value>,
    field_name: &str,
) -> ApiResult<Option<Option<bool>>> {
    match raw {
        None => Ok(None),
        Some(serde_json::Value::Null) => Ok(Some(None)),
        Some(serde_json::Value::Bool(value)) => Ok(Some(Some(*value))),
        Some(_) => Err(bad_request_error(format!(
            "{field_name} must be true, false, or null",
        ))),
    }
}

/// Parses the optional reevaluate flag from the raw JSON object.
fn parse_reevaluate_field(raw: Option<&serde_json::Value>) -> ApiResult<bool> {
    match raw {
        None => Ok(false),
        Some(serde_json::Value::Bool(value)) => Ok(*value),
        Some(_) => Err(bad_request_error("reevaluate must be true or false")),
    }
}

#[cfg(test)]
mod feed_title_tests {
    use super::*;

    #[test]
    fn extract_xml_feed_title_normalizes_multiline_title() {
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>
    tagesschau.de - die erste Adresse für Nachrichten und Information
  </title>
</feed>"#;

        assert_eq!(
            extract_xml_feed_title(body.as_bytes()).as_deref(),
            Some("tagesschau.de - die erste Adresse für Nachrichten und Information")
        );
    }

    #[test]
    fn extract_xml_feed_title_decodes_basic_entities() {
        let body = br#"<rss><channel><title>News &amp; Information</title></channel></rss>"#;

        assert_eq!(
            extract_xml_feed_title(body).as_deref(),
            Some("News & Information")
        );
    }

    #[test]
    fn normalize_feed_title_rejects_blank_titles() {
        assert_eq!(normalize_feed_title(Some(" \n\t ".to_string())), None);
    }
}
