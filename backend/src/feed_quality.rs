//! Feed-quality evaluation and manual overrides shared by CLI and API callers.

use anyhow::{Context, Result};
use sqlx::SqlitePool;

use crate::article_store;
use crate::config::Config;
use crate::content::{self, FeedContentState};
use crate::repo::feeds::{self, FeedQualityState};
use crate::{db, feed_ingestion, http_client};

/// Human-readable result of a forced feed-quality re-evaluation.
#[derive(Debug)]
pub struct FeedQualityReevaluationResult {
    pub feed_id: i64,
    pub feed_title: Option<String>,
    pub use_extracted_fulltext: bool,
    pub use_llm_summary: bool,
    pub manual_use_extracted_fulltext: Option<bool>,
    pub manual_use_llm_summary: Option<bool>,
    pub last_quality_check: Option<i64>,
    pub last_manual_quality_override: Option<i64>,
}

/// Feed-quality mutation payload expressed as explicit field updates.
///
/// `Some(Some(value))` applies a manual override, `Some(None)` clears that attribute back to
/// automatic mode, and `None` leaves the attribute unchanged.
#[derive(Debug, Clone, Copy)]
pub struct FeedQualityOverrideUpdate {
    pub use_extracted_fulltext: Option<Option<bool>>,
    pub use_llm_summary: Option<Option<bool>>,
}

/// Re-evaluates one regular feed's full-text and summary quality flags immediately.
///
/// This command fetches and parses the selected feed, forces the quality-check path to run even
/// when the last monthly evaluation is still fresh, and persists only the feed-level quality
/// flags. It does not ingest articles or recalculate the feed cadence.
pub async fn reevaluate_feed_quality(
    config: &Config,
    feed_id: i64,
) -> Result<FeedQualityReevaluationResult> {
    let pool = db::create_pool(&config.db_path)
        .await
        .with_context(|| format!("failed to connect to sqlite db at {}", config.db_path))?;
    reevaluate_single_feed_quality(&pool, config, feed_id, config.testing_mode).await
}

/// Manually sets one or both feed-level quality flags and locks only the provided attributes.
///
/// The selected attribute overrides are persisted as manual values so future automatic monthly
/// quality checks keep those attributes fixed while continuing to evaluate any unlocked
/// attributes. The command also updates the effective feed flags and stamps both the quality-check
/// time and the manual-override time.
pub async fn set_feed_quality_overrides(
    config: &Config,
    feed_id: i64,
    use_extracted_fulltext: Option<bool>,
    use_llm_summary: Option<bool>,
) -> Result<FeedQualityReevaluationResult> {
    anyhow::ensure!(
        use_extracted_fulltext.is_some() || use_llm_summary.is_some(),
        "at least one of --use-extracted-fulltext or --use-llm-summary must be provided"
    );

    let pool = db::create_pool(&config.db_path)
        .await
        .with_context(|| format!("failed to connect to sqlite db at {}", config.db_path))?;
    set_single_feed_quality_overrides(&pool, feed_id, use_extracted_fulltext, use_llm_summary).await
}

/// Re-evaluates one feed's quality flags using an existing connection pool.
pub async fn reevaluate_feed_quality_with_pool(
    pool: &SqlitePool,
    config: &Config,
    feed_id: i64,
    testing_mode: bool,
) -> Result<FeedQualityReevaluationResult> {
    reevaluate_single_feed_quality(pool, config, feed_id, testing_mode).await
}

/// Applies explicit feed-quality override updates using an existing connection pool.
pub async fn update_feed_quality_overrides_with_pool(
    pool: &SqlitePool,
    feed_id: i64,
    update: FeedQualityOverrideUpdate,
) -> Result<FeedQualityReevaluationResult> {
    anyhow::ensure!(
        update.use_extracted_fulltext.is_some() || update.use_llm_summary.is_some(),
        "at least one feed-quality attribute must be provided"
    );

    update_single_feed_quality_overrides(
        pool,
        feed_id,
        update.use_extracted_fulltext,
        update.use_llm_summary,
    )
    .await
}

/// Fetches one regular feed and forces a fresh content-quality evaluation.
pub(crate) async fn reevaluate_single_feed_quality(
    pool: &SqlitePool,
    config: &Config,
    feed_id: i64,
    testing_mode: bool,
) -> Result<FeedQualityReevaluationResult> {
    let article_http_client = http_client::build_article_http_client()?;
    let feed = feeds::find_regular(pool, feed_id)
        .await
        .context("failed to load feed for quality re-evaluation")?
        .with_context(|| format!("feed {feed_id} not found"))?;
    let parsed = feed_ingestion::fetch_and_parse_feed(&feed.url, testing_mode).await?;
    tracing::info!(
        feed_id,
        "starting forced feed content quality re-evaluation"
    );

    feeds::clear_quality_overrides(pool, feed_id)
        .await
        .context("failed to clear manual feed quality overrides")?;

    let next_state = content::maybe_refresh_feed_content_state(
        pool,
        &article_http_client,
        config,
        feed.id,
        &feed.url,
        FeedContentState {
            last_quality_check: None,
            use_extracted_fulltext: feed.use_extracted_fulltext,
            use_llm_summary: feed.use_llm_summary,
            manual_use_extracted_fulltext: None,
            manual_use_llm_summary: None,
        },
        &parsed.entries,
    )
    .await?;

    tracing::info!(
        feed_id,
        "finished forced feed content quality re-evaluation"
    );
    Ok(FeedQualityReevaluationResult {
        feed_id,
        feed_title: feed.title,
        use_extracted_fulltext: next_state.use_extracted_fulltext,
        use_llm_summary: next_state.use_llm_summary,
        manual_use_extracted_fulltext: next_state.manual_use_extracted_fulltext,
        manual_use_llm_summary: next_state.manual_use_llm_summary,
        last_quality_check: next_state.last_quality_check,
        last_manual_quality_override: None,
    })
}

/// Persists manual overrides for one regular feed without fetching the remote document.
pub(crate) async fn set_single_feed_quality_overrides(
    pool: &SqlitePool,
    feed_id: i64,
    use_extracted_fulltext: Option<bool>,
    use_llm_summary: Option<bool>,
) -> Result<FeedQualityReevaluationResult> {
    update_single_feed_quality_overrides(
        pool,
        feed_id,
        use_extracted_fulltext.map(Some),
        use_llm_summary.map(Some),
    )
    .await
}

/// Applies explicit quality override updates for one regular feed without fetching remote content.
pub(crate) async fn update_single_feed_quality_overrides(
    pool: &SqlitePool,
    feed_id: i64,
    use_extracted_fulltext: Option<Option<bool>>,
    use_llm_summary: Option<Option<bool>>,
) -> Result<FeedQualityReevaluationResult> {
    let feed = feeds::find_regular(pool, feed_id)
        .await
        .context("failed to load feed for manual quality override")?
        .with_context(|| format!("feed {feed_id} not found"))?;

    let now = article_store::unix_now();
    let manual_use_extracted_fulltext =
        use_extracted_fulltext.unwrap_or(feed.manual_use_extracted_fulltext);
    let manual_use_llm_summary = use_llm_summary.unwrap_or(feed.manual_use_llm_summary);
    let effective_use_extracted_fulltext = match use_extracted_fulltext {
        Some(Some(value)) => value,
        Some(None) | None => feed.use_extracted_fulltext,
    };
    let effective_use_llm_summary = match use_llm_summary {
        Some(Some(value)) => value,
        Some(None) | None => feed.use_llm_summary,
    };
    let touched_manual_override = use_extracted_fulltext.is_some() || use_llm_summary.is_some();
    let updated_last_quality_check = if matches!(use_extracted_fulltext, Some(Some(_)))
        || matches!(use_llm_summary, Some(Some(_)))
    {
        Some(now)
    } else {
        feed.last_quality_check
    };
    let updated_last_manual_quality_override = if !touched_manual_override {
        feed.last_manual_quality_override
    } else if manual_use_extracted_fulltext.is_some() || manual_use_llm_summary.is_some() {
        Some(now)
    } else {
        None
    };

    feeds::save_quality_overrides(
        pool,
        feed_id,
        &FeedQualityState {
            use_extracted_fulltext: effective_use_extracted_fulltext,
            use_llm_summary: effective_use_llm_summary,
            manual_use_extracted_fulltext,
            manual_use_llm_summary,
            last_quality_check: updated_last_quality_check,
            last_manual_quality_override: updated_last_manual_quality_override,
        },
    )
    .await
    .context("failed to persist manual feed quality overrides")?;

    Ok(FeedQualityReevaluationResult {
        feed_id,
        feed_title: feed.title,
        use_extracted_fulltext: effective_use_extracted_fulltext,
        use_llm_summary: effective_use_llm_summary,
        manual_use_extracted_fulltext,
        manual_use_llm_summary,
        last_quality_check: updated_last_quality_check,
        last_manual_quality_override: updated_last_manual_quality_override,
    })
}
