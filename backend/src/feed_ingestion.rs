//! Shared feed fetching, parsing, article ingestion, cleanup, and refresh cadence helpers.

use anyhow::{Context, Result};
use feed_rs::model::{Entry, Feed};
use rand::RngExt;
use reqwest::StatusCode;
use sqlx::SqlitePool;

use crate::article_store::{self, InsertArticleOutcome};
use crate::config::Config;
use crate::content::FeedContentState;
use crate::ssrf;

/// Maximum number of entries ingested from a single feed payload.
pub const MAX_FEED_ENTRIES: usize = 50;
/// Jitter window in seconds for sparse-feed refreshes.
pub const THIRTY_MINUTES: i64 = 1_800;
/// Maximum interval for active feeds.
pub const TWELVE_HOURS: i64 = 43_200;
/// One day in seconds.
pub const ONE_DAY: i64 = 86_400;
/// Retention window for stale feed-article cleanup.
pub const NINETY_DAYS: i64 = 90 * ONE_DAY;

/// Shared context for ingesting entries from one feed payload.
pub struct FeedEntryIngestionContext<'a> {
    pub pool: &'a SqlitePool,
    pub article_http_client: &'a reqwest::Client,
    pub config: &'a Config,
    pub feed_id: i64,
    pub feed_url: &'a str,
    pub content_state: FeedContentState,
}

/// Counts and guid hashes collected while ingesting a parsed feed payload.
#[derive(Debug, Default)]
pub struct FeedIngestionStats {
    pub processed: usize,
    pub inserted: usize,
    pub current_feed_guid_hashes: Vec<String>,
}

/// Feed fetch/parse errors that API handlers can map to public error responses.
#[derive(Debug)]
pub enum FeedFetchParseError {
    SafeGet(ssrf::SafeGetError),
    BadStatus(StatusCode),
    Body(reqwest::Error),
    Parse(String),
}

impl std::fmt::Display for FeedFetchParseError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SafeGet(error) => write!(formatter, "{error:?}"),
            Self::BadStatus(status) => write!(formatter, "HTTP {status}"),
            Self::Body(error) => write!(formatter, "{error}"),
            Self::Parse(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for FeedFetchParseError {}

impl FeedIngestionStats {
    /// Number of parsed entries skipped because they were duplicates or invalid article records.
    pub fn skipped(&self) -> usize {
        self.processed.saturating_sub(self.inserted)
    }
}

/// Downloads a remote feed document through SSRF-safe redirects and parses it.
pub async fn fetch_and_parse_feed(url: &str, testing_mode: bool) -> Result<Feed> {
    match fetch_and_parse_feed_checked(url, testing_mode).await {
        Ok(feed) => Ok(feed),
        Err(FeedFetchParseError::SafeGet(error)) => {
            let error = match error {
                ssrf::SafeGetError::Validation(error) | ssrf::SafeGetError::Request(error) => error,
            };
            Err(error).with_context(|| format!("request failed for {url}"))
        }
        Err(FeedFetchParseError::BadStatus(status)) => {
            anyhow::bail!("request failed for {url}: HTTP {status}")
        }
        Err(FeedFetchParseError::Body(error)) => Err(error).context("failed to read response body"),
        Err(FeedFetchParseError::Parse(error)) => {
            Err(anyhow::anyhow!(error)).context("failed to parse feed")
        }
    }
}

/// Downloads a remote feed document and preserves structured failure reasons for API mapping.
pub async fn fetch_and_parse_feed_checked(
    url: &str,
    testing_mode: bool,
) -> std::result::Result<Feed, FeedFetchParseError> {
    let response = ssrf::get_with_safe_redirects(
        crate::http_client::HttpClientProfile::Feed,
        url,
        testing_mode,
    )
    .await
    .map_err(FeedFetchParseError::SafeGet)?;
    if !response.status().is_success() {
        return Err(FeedFetchParseError::BadStatus(response.status()));
    }

    let bytes = response.bytes().await.map_err(FeedFetchParseError::Body)?;
    feed_rs::parser::parse(&bytes[..]).map_err(|err| FeedFetchParseError::Parse(err.to_string()))
}

/// Ingests the bounded entry set from one parsed feed payload.
pub async fn ingest_feed_entries(
    context: &FeedEntryIngestionContext<'_>,
    entries: &[Entry],
) -> Result<FeedIngestionStats> {
    let mut stats = FeedIngestionStats::default();

    for entry in entries.iter().take(MAX_FEED_ENTRIES) {
        stats.processed += 1;
        if insert_article_from_entry(context, entry, &mut stats.current_feed_guid_hashes).await? {
            stats.inserted += 1;
        }
    }

    Ok(stats)
}

/// Removes stale feed articles that are absent from the latest payload.
///
/// Articles are only eligible when they are old, read, and unstarred, so refreshes do not delete
/// recent unread content or user-saved items.
pub async fn cleanup_stale_feed_articles(
    pool: &SqlitePool,
    feed_id: i64,
    current_feed_guid_hashes: &[String],
) -> Result<u64> {
    let stale_before = article_store::unix_now() - NINETY_DAYS;

    let result = if current_feed_guid_hashes.is_empty() {
        sqlx::query(
            "DELETE FROM article WHERE feed_id = ? AND last_modified < ? AND unread = 0 AND starred = 0",
        )
        .bind(feed_id)
        .bind(stale_before)
        .execute(pool)
        .await
        .context("failed stale article cleanup query")?
    } else {
        let placeholders = vec!["?"; current_feed_guid_hashes.len()].join(", ");
        let query = format!(
            "DELETE FROM article WHERE feed_id = ? AND last_modified < ? AND unread = 0 AND starred = 0 AND guid_hash NOT IN ({placeholders})"
        );

        let mut cleanup_query = sqlx::query(&query).bind(feed_id).bind(stale_before);
        for guid_hash in current_feed_guid_hashes {
            cleanup_query = cleanup_query.bind(guid_hash);
        }

        cleanup_query
            .execute(pool)
            .await
            .context("failed stale article cleanup query")?
    };

    Ok(result.rows_affected())
}

/// Calculates the next refresh timestamp from the last 7 days of observed article output.
pub async fn calculate_next_update_time(
    pool: &SqlitePool,
    feed_id: i64,
    now_ts: i64,
) -> Result<i64> {
    let weekly_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM article WHERE feed_id = ? AND pub_date > ?")
            .bind(feed_id)
            .bind(now_ts - 7 * ONE_DAY)
            .fetch_one(pool)
            .await
            .context("failed to query recent article frequency")?;

    let avg_articles_per_day = weekly_count as f64 / 7.0;
    let next_update_in =
        compute_next_update_interval(avg_articles_per_day, random_jitter_seconds());

    tracing::info!(
        feed_id,
        avg_articles_per_day,
        next_update_in_minutes = (next_update_in as f64 / 60.0),
        "calculated next dynamic update time"
    );

    Ok(now_ts + next_update_in)
}

/// Returns a signed jitter value in seconds in [-30m, +30m].
pub fn random_jitter_seconds() -> i64 {
    let mut rng = rand::rng();
    rng.random_range(-THIRTY_MINUTES..=THIRTY_MINUTES)
}

/// Computes the next refresh interval in seconds from recent publishing frequency.
pub fn compute_next_update_interval(avg_articles_per_day: f64, jitter_seconds: i64) -> i64 {
    if avg_articles_per_day <= 0.1 {
        return ONE_DAY + jitter_seconds.clamp(-THIRTY_MINUTES, THIRTY_MINUTES);
    }

    ((ONE_DAY as f64 / avg_articles_per_day / 4.0).round() as i64).min(TWELVE_HOURS)
}

/// Converts one parsed feed entry into a persisted article when it is not a duplicate.
async fn insert_article_from_entry(
    entry_context: &FeedEntryIngestionContext<'_>,
    entry: &Entry,
    current_feed_guid_hashes: &mut Vec<String>,
) -> Result<bool> {
    let Some(article) = article_store::article_record_from_feed_entry(entry_context.feed_id, entry)
    else {
        tracing::debug!(
            feed_id = entry_context.feed_id,
            "skipping entry without guid/link/title"
        );
        return Ok(false);
    };

    current_feed_guid_hashes.push(article.guid_hash.clone());

    let ingestion_context = article_store::ArticleIngestionContext {
        pool: entry_context.pool,
        article_http_client: entry_context.article_http_client,
        config: entry_context.config,
        feed_url: Some(entry_context.feed_url),
        content_state: entry_context.content_state,
    };

    match article_store::ingest_article_if_new(&ingestion_context, article)
        .await
        .context("failed to insert article")?
    {
        InsertArticleOutcome::Inserted { .. } => Ok(true),
        InsertArticleOutcome::Duplicate { guid_hash } => {
            tracing::debug!(
                feed_id = entry_context.feed_id,
                guid_hash,
                "skipping duplicate entry"
            );
            Ok(false)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncWriteExt;
    use tokio::net::TcpListener;

    async fn spawn_one_shot_server(response: &'static [u8]) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            stream.write_all(response).await.unwrap();
            let _ = stream.shutdown().await;
        });
        format!("http://{addr}/feed.xml")
    }

    #[tokio::test]
    async fn fetch_and_parse_feed_checked_returns_validation_error_for_blocked_loopback_url() {
        let url = "http://127.0.0.1:1/feed.xml";

        match fetch_and_parse_feed_checked(url, false).await {
            Err(FeedFetchParseError::SafeGet(ssrf::SafeGetError::Validation(_))) => {}
            other => panic!("expected SSRF validation error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn fetch_and_parse_feed_checked_returns_bad_status_for_non_success_response() {
        let response =
            b"HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let url = spawn_one_shot_server(response).await;

        match fetch_and_parse_feed_checked(&url, true).await {
            Err(FeedFetchParseError::BadStatus(StatusCode::INTERNAL_SERVER_ERROR)) => {}
            other => panic!("expected bad status error, got {other:?}"),
        }

        let url = spawn_one_shot_server(response).await;
        let error = fetch_and_parse_feed(&url, true).await.unwrap_err();
        assert!(error.to_string().contains("HTTP 500 Internal Server Error"));
    }

    #[tokio::test]
    async fn fetch_and_parse_feed_checked_returns_body_error_for_truncated_response() {
        let response = b"HTTP/1.1 200 OK\r\nContent-Length: 32\r\nConnection: close\r\n\r\nabc";
        let url = spawn_one_shot_server(response).await;

        match fetch_and_parse_feed_checked(&url, true).await {
            Err(FeedFetchParseError::Body(_)) => {}
            other => panic!("expected body read error, got {other:?}"),
        }

        let url = spawn_one_shot_server(response).await;
        let error = fetch_and_parse_feed(&url, true).await.unwrap_err();
        assert!(error.to_string().contains("failed to read response body"));
    }

    #[tokio::test]
    async fn fetch_and_parse_feed_checked_returns_parse_error_for_invalid_feed_document() {
        let response = b"HTTP/1.1 200 OK\r\nContent-Type: application/xml\r\nContent-Length: 20\r\nConnection: close\r\n\r\nnot a valid feed xml";
        let url = spawn_one_shot_server(response).await;

        match fetch_and_parse_feed_checked(&url, true).await {
            Err(FeedFetchParseError::Parse(message)) => {
                assert!(
                    !message.is_empty(),
                    "parse error message should not be empty"
                );
            }
            other => panic!("expected parse error, got {other:?}"),
        }

        let url = spawn_one_shot_server(response).await;
        let error = fetch_and_parse_feed(&url, true).await.unwrap_err();
        assert!(error.to_string().contains("failed to parse feed"));
    }
}
