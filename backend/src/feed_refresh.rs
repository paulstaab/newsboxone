//! Single-feed refresh service: quality evaluation, entry ingestion, and cadence persistence.

use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::article_store;
use crate::config::Config;
use crate::content::{self, FeedContentState};
use crate::feed_ingestion::{self, FeedEntryIngestionContext};
use crate::repo::feeds::{self, RefreshFeedRecord};

/// Refreshes one feed, ingests up to 25 entries, updates dynamic cadence, and clears error state.
pub async fn update_single_feed(
    pool: &SqlitePool,
    article_http_client: &reqwest::Client,
    config: &Config,
    feed: &RefreshFeedRecord,
    testing_mode: bool,
) -> Result<()> {
    let feed_id = feed.id;
    let url = feed.url.as_str();
    tracing::debug!(feed_id, testing_mode, "starting feed update");
    let parsed = feed_ingestion::fetch_and_parse_feed(url, testing_mode).await?;
    let content_state = content::maybe_refresh_feed_content_state(
        pool,
        article_http_client,
        config,
        feed_id,
        &feed.url,
        FeedContentState {
            last_quality_check: feed.last_quality_check,
            use_extracted_fulltext: feed.use_extracted_fulltext,
            use_llm_summary: feed.use_llm_summary,
            manual_use_extracted_fulltext: feed.manual_use_extracted_fulltext,
            manual_use_llm_summary: feed.manual_use_llm_summary,
        },
        &parsed.entries,
    )
    .await?;

    let entry_context = FeedEntryIngestionContext {
        pool,
        article_http_client,
        config,
        feed_id,
        feed_url: &feed.url,
        content_state,
    };

    let stats = feed_ingestion::ingest_feed_entries(&entry_context, &parsed.entries).await?;

    let now_ts = article_store::unix_now();
    let next_update_time =
        feed_ingestion::calculate_next_update_time(pool, feed_id, now_ts).await?;
    feeds::complete_refresh(pool, feed_id, next_update_time)
        .await
        .context("failed to update feed metadata")?;

    tracing::info!(
        feed_id,
        processed = stats.processed,
        inserted = stats.inserted,
        skipped = stats.skipped(),
        "feed update completed"
    );
    Ok(())
}
