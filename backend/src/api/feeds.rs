//! Feed handlers and feed-related article ingestion helpers.

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::article_store;
use crate::config::Config;
use crate::content::FeedContentState;
use crate::repo;
use crate::ssrf;
use crate::updater::{self, FeedQualityOverrideUpdate};

use super::AppState;
use super::errors::{
    ApiResult, bad_request_error, feed_already_exists, feed_not_found_with_id, feed_parse_error,
    internal_error, ssrf_error,
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
    newest_item_id: i64,
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

    let response = ssrf::get_with_safe_redirects(
        crate::http_client::HttpClientProfile::Feed,
        &input.url,
        config.testing_mode,
    )
    .await
    .map_err(|error| match error {
        ssrf::SafeGetError::Validation(error) => ssrf_error(error),
        ssrf::SafeGetError::Request(error) => feed_parse_error(error),
    })?;
    if !response.status().is_success() {
        return Err(feed_parse_error(format!(
            "Error parsing feed from `{}`: HTTP {}",
            input.url,
            response.status()
        )));
    }

    let bytes = response.bytes().await.map_err(feed_parse_error)?;
    let parsed = feed_rs::parser::parse(&bytes[..]).map_err(|err| {
        feed_parse_error(format!("Error parsing feed from `{}`: {err}", input.url))
    })?;

    let now_ts = article_store::unix_now();
    let title = parsed.title.map(|t| t.content);
    let link = parsed.links.first().map(|l| l.href.clone());

    let result = sqlx::query(
        "INSERT INTO feed (url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error) VALUES (?, ?, NULL, ?, NULL, ?, ?, 0, ?, 0, 0, NULL)",
    )
    .bind(&input.url)
    .bind(title)
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

    for entry in parsed.entries.iter().take(50) {
        insert_article_from_entry(
            pool,
            article_http_client,
            config,
            feed_id,
            &input.url,
            entry,
            content_state,
        )
        .await?;
    }

    let feeds = load_feeds(pool).await?;
    Ok(Json(FeedCreateOut {
        feeds,
        newest_item_id: feed_id,
    }))
}

async fn insert_article_from_entry(
    pool: &SqlitePool,
    article_http_client: &reqwest::Client,
    config: &Config,
    feed_id: i64,
    feed_url: &str,
    entry: &feed_rs::model::Entry,
    content_state: FeedContentState,
) -> ApiResult<()> {
    let Some(article) = article_store::article_record_from_feed_entry(feed_id, entry) else {
        return Ok(());
    };

    let context = article_store::ArticleIngestionContext {
        pool,
        article_http_client,
        config,
        feed_url: Some(feed_url),
        content_state,
    };
    let _ = article_store::ingest_article_if_new(&context, article)
        .await
        .map_err(internal_error)?;

    Ok(())
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
            "SELECT id, url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override FROM feed WHERE id = ? ORDER BY id",
        )
        .bind(feed_id)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, FeedRow>(
            "SELECT id, url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override FROM feed ORDER BY id",
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
    if let Some(feed_id) = detail
        .strip_prefix("feed ")
        .and_then(|rest| rest.split_whitespace().next())
        .and_then(|value| value.parse::<i64>().ok())
    {
        return feed_not_found_with_id(feed_id);
    }

    bad_request_error(detail)
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
