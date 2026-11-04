//! Typed feed projections and persistence shared by refresh, quality, and API services.

use sqlx::{FromRow, QueryBuilder, Sqlite, SqlitePool};

/// Active feed metadata shared by the public API and ingestion services.
#[derive(FromRow)]
pub struct FeedRecord {
    pub id: i64,
    pub url: String,
    pub title: Option<String>,
    pub favicon_link: Option<String>,
    pub added: i64,
    pub last_article_date: Option<i64>,
    pub next_update_time: Option<i64>,
    pub folder_id: i64,
    pub ordering: i64,
    pub link: Option<String>,
    pub pinned: bool,
    pub update_error_count: i64,
    pub last_update_error: Option<String>,
    pub is_mailing_list: bool,
    pub last_quality_check: Option<i64>,
    pub use_extracted_fulltext: bool,
    pub use_llm_summary: bool,
    pub manual_use_extracted_fulltext: Option<bool>,
    pub manual_use_llm_summary: Option<bool>,
    pub last_manual_quality_override: Option<i64>,
}

/// Feed fields needed by the scheduled refresh loop; smaller than the public API projection.
#[derive(FromRow)]
pub struct RefreshFeedRecord {
    pub id: i64,
    pub url: String,
    #[allow(dead_code)]
    pub next_update_time: Option<i64>,
    pub last_quality_check: Option<i64>,
    pub use_extracted_fulltext: bool,
    pub use_llm_summary: bool,
    pub manual_use_extracted_fulltext: Option<bool>,
    pub manual_use_llm_summary: Option<bool>,
    pub last_manual_quality_override: Option<i64>,
}

/// Quality fields written together when applying manual override changes.
pub struct FeedQualityState {
    pub use_extracted_fulltext: bool,
    pub use_llm_summary: bool,
    pub manual_use_extracted_fulltext: Option<bool>,
    pub manual_use_llm_summary: Option<bool>,
    pub last_quality_check: Option<i64>,
    pub last_manual_quality_override: Option<i64>,
}

const FEED_SELECT: &str = "SELECT id, url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, is_mailing_list, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override FROM feed WHERE deleted_at IS NULL";
const REFRESH_FEED_SELECT: &str = "SELECT id, url, next_update_time, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override FROM feed WHERE deleted_at IS NULL AND is_mailing_list = 0";

/// Lists active feeds in API order, optionally restricted to one identifier.
pub async fn list_active(
    pool: &SqlitePool,
    feed_id: Option<i64>,
) -> Result<Vec<FeedRecord>, sqlx::Error> {
    let mut query = QueryBuilder::<Sqlite>::new(FEED_SELECT);
    if let Some(id) = feed_id {
        query.push(" AND id = ").push_bind(id);
    }
    query.push(" ORDER BY id");
    query.build_query_as().fetch_all(pool).await
}

/// Lists regular active feeds, optionally restricting selection to schedules due at a timestamp.
pub async fn list_regular(
    pool: &SqlitePool,
    due_at: Option<i64>,
) -> Result<Vec<RefreshFeedRecord>, sqlx::Error> {
    let mut query = QueryBuilder::<Sqlite>::new(REFRESH_FEED_SELECT);
    if let Some(now) = due_at {
        query
            .push(" AND (next_update_time IS NULL OR next_update_time <= ")
            .push_bind(now)
            .push(")");
    }
    query.push(" ORDER BY id");
    query.build_query_as().fetch_all(pool).await
}

/// Loads an active regular feed, excluding newsletters and deleted subscriptions.
pub async fn find_regular(
    pool: &SqlitePool,
    feed_id: i64,
) -> Result<Option<RefreshFeedRecord>, sqlx::Error> {
    QueryBuilder::<Sqlite>::new(REFRESH_FEED_SELECT)
        .push(" AND id = ")
        .push_bind(feed_id)
        .build_query_as()
        .fetch_optional(pool)
        .await
}

/// Records a failed refresh without modifying schedule or quality metadata.
pub async fn record_refresh_error(
    pool: &SqlitePool,
    feed_id: i64,
    detail: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feed SET update_error_count = update_error_count + 1, last_update_error = ? WHERE id = ?")
        .bind(detail).bind(feed_id).execute(pool).await?;
    Ok(())
}

/// Clears refresh errors and persists the next scheduled refresh after successful ingestion.
pub async fn complete_refresh(
    pool: &SqlitePool,
    feed_id: i64,
    next_update_time: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feed SET update_error_count = 0, last_update_error = NULL, next_update_time = ? WHERE id = ?")
        .bind(next_update_time).bind(feed_id).execute(pool).await?;
    Ok(())
}

/// Clears manual locks before a forced quality evaluation without changing effective flags.
pub async fn clear_quality_overrides(pool: &SqlitePool, feed_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feed SET manual_use_extracted_fulltext = NULL, manual_use_llm_summary = NULL, last_manual_quality_override = NULL WHERE id = ?")
        .bind(feed_id).execute(pool).await?;
    Ok(())
}

/// Persists effective quality flags while preserving manual overrides and refresh metadata.
pub async fn save_evaluated_quality(
    pool: &SqlitePool,
    feed_id: i64,
    checked_at: Option<i64>,
    use_extracted_fulltext: bool,
    use_llm_summary: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feed SET last_quality_check = ?, use_extracted_fulltext = ?, use_llm_summary = ? WHERE id = ?")
        .bind(checked_at).bind(use_extracted_fulltext).bind(use_llm_summary).bind(feed_id).execute(pool).await?;
    Ok(())
}

/// Persists manual and effective quality state without changing articles or refresh cadence.
pub async fn save_quality_overrides(
    pool: &SqlitePool,
    feed_id: i64,
    state: &FeedQualityState,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feed SET use_extracted_fulltext = ?, use_llm_summary = ?, manual_use_extracted_fulltext = ?, manual_use_llm_summary = ?, last_quality_check = ?, last_manual_quality_override = ? WHERE id = ?")
        .bind(state.use_extracted_fulltext).bind(state.use_llm_summary)
        .bind(state.manual_use_extracted_fulltext).bind(state.manual_use_llm_summary)
        .bind(state.last_quality_check).bind(state.last_manual_quality_override)
        .bind(feed_id).execute(pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Seeds migrated storage with explicit feed scheduling and lifecycle states.
    async fn seed_feed(
        pool: &SqlitePool,
        id: i64,
        next_update_time: Option<i64>,
        newsletter: bool,
        deleted_at: Option<i64>,
    ) {
        sqlx::query("INSERT INTO feed (id, url, added, folder_id, next_update_time, is_mailing_list, deleted_at) VALUES (?, ?, 1, 0, ?, ?, ?)")
            .bind(id).bind(format!("https://example.org/{id}"))
            .bind(next_update_time).bind(newsletter).bind(deleted_at)
            .execute(pool).await.unwrap();
    }

    /// Ensures shared projections retain due-time boundaries and lifecycle exclusions.
    #[tokio::test]
    async fn tc_pipe_040_feed_selection_preserves_schedule_and_lifecycle_filters() {
        let pool = crate::db::create_memory_pool().await.unwrap();
        seed_feed(&pool, 1, None, false, None).await;
        seed_feed(&pool, 2, Some(100), false, None).await;
        seed_feed(&pool, 3, Some(101), false, None).await;
        seed_feed(&pool, 4, None, true, None).await;
        seed_feed(&pool, 5, None, false, Some(1)).await;

        let mut due_ids: Vec<_> = list_regular(&pool, Some(100))
            .await
            .unwrap()
            .iter()
            .map(|feed| feed.id)
            .collect();
        due_ids.sort_unstable();
        assert_eq!(due_ids, vec![1, 2]);
        assert_eq!(list_regular(&pool, None).await.unwrap().len(), 3);
        let active_ids: Vec<_> = list_active(&pool, None)
            .await
            .unwrap()
            .iter()
            .map(|feed| feed.id)
            .collect();
        assert_eq!(active_ids, vec![1, 2, 3, 4]);
        assert_eq!(list_active(&pool, Some(4)).await.unwrap()[0].id, 4);
        assert!(list_active(&pool, Some(5)).await.unwrap().is_empty());
        for excluded in [4, 5, 404] {
            assert!(find_regular(&pool, excluded).await.unwrap().is_none());
        }
        assert_eq!(
            find_regular(&pool, 3)
                .await
                .unwrap()
                .unwrap()
                .next_update_time,
            Some(101)
        );
    }

    /// Guards independent quality, manual-lock, and refresh fields against accidental overwrites.
    #[tokio::test]
    async fn tc_pipe_041_quality_and_refresh_mutations_preserve_independent_metadata() {
        let pool = crate::db::create_memory_pool().await.unwrap();
        seed_feed(&pool, 1, Some(900), false, None).await;
        seed_feed(&pool, 2, Some(800), false, None).await;
        save_quality_overrides(
            &pool,
            1,
            &FeedQualityState {
                use_extracted_fulltext: true,
                use_llm_summary: false,
                manual_use_extracted_fulltext: Some(true),
                manual_use_llm_summary: None,
                last_quality_check: Some(20),
                last_manual_quality_override: Some(20),
            },
        )
        .await
        .unwrap();
        record_refresh_error(&pool, 1, "fixture error")
            .await
            .unwrap();
        save_evaluated_quality(&pool, 1, Some(30), true, true)
            .await
            .unwrap();
        let feed = find_regular(&pool, 1).await.unwrap().unwrap();
        assert_eq!(feed.next_update_time, Some(900));
        assert_eq!(feed.manual_use_extracted_fulltext, Some(true));
        assert_eq!(feed.last_quality_check, Some(20));

        complete_refresh(&pool, 1, 1000).await.unwrap();
        let feed = find_regular(&pool, 1).await.unwrap().unwrap();
        assert_eq!(feed.next_update_time, Some(1000));
        assert_eq!(feed.last_quality_check, Some(30));
        assert!(feed.use_extracted_fulltext && feed.use_llm_summary);
        assert_eq!(feed.manual_use_extracted_fulltext, Some(true));

        clear_quality_overrides(&pool, 1).await.unwrap();
        let feed = find_regular(&pool, 1).await.unwrap().unwrap();
        assert!(feed.manual_use_extracted_fulltext.is_none());
        assert!(feed.manual_use_llm_summary.is_none());
        assert_eq!(feed.last_quality_check, Some(30));
        assert!(feed.use_extracted_fulltext && feed.use_llm_summary);
        assert_eq!(feed.next_update_time, Some(1000));
        let other = find_regular(&pool, 2).await.unwrap().unwrap();
        assert_eq!(other.next_update_time, Some(800));
        assert!(other.last_quality_check.is_none());
        assert!(!other.use_extracted_fulltext && !other.use_llm_summary);
    }
}
