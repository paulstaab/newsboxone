//! Shared persistence helpers for folders, feeds, and articles.

use sqlx::{Executor, QueryBuilder, Sqlite, SqlitePool};

use crate::article_store::ArticleRecord;

/// Row-deletion counts returned by cascading feed cleanup operations.
pub struct FeedDeleteCounts {
    /// Number of article rows deleted before the feed row was removed.
    pub deleted_articles: u64,
    /// Number of feed rows removed or soft-deleted for the requested identifier.
    pub deleted_feeds: u64,
}

/// Row-deletion counts returned by cascading folder cleanup operations.
pub struct FolderDeleteCounts {
    /// Number of article rows deleted from feeds that belonged to the folder.
    pub deleted_articles: u64,
    /// Number of feed rows removed or soft-deleted from the folder.
    pub deleted_feeds: u64,
    /// Number of folder rows deleted for the requested identifier.
    pub deleted_folders: u64,
}

/// Logical article flag fields supported by bulk mutations.
#[derive(Clone, Copy)]
pub enum ArticleFlag {
    /// Read/unread state used by item read tracking.
    Unread,
    /// Starred state used by item bookmarking.
    Starred,
}

impl ArticleFlag {
    fn column_name(self) -> &'static str {
        match self {
            Self::Unread => "unread",
            Self::Starred => "starred",
        }
    }
}

/// Returns whether a folder with the given identifier exists.
pub async fn folder_exists(pool: &SqlitePool, folder_id: i64) -> Result<bool, sqlx::Error> {
    let existing: Option<i64> = sqlx::query_scalar("SELECT id FROM folder WHERE id = ? LIMIT 1")
        .bind(folder_id)
        .fetch_optional(pool)
        .await?;

    Ok(existing.is_some())
}

/// Returns whether a non-root user-visible folder with the given identifier exists.
pub async fn public_folder_exists(pool: &SqlitePool, folder_id: i64) -> Result<bool, sqlx::Error> {
    let existing: Option<i64> =
        sqlx::query_scalar("SELECT id FROM folder WHERE id = ? AND is_root = 0 LIMIT 1")
            .bind(folder_id)
            .fetch_optional(pool)
            .await?;

    Ok(existing.is_some())
}

/// Returns whether a folder name already exists, optionally excluding one folder id.
pub async fn folder_name_exists(
    pool: &SqlitePool,
    name: &str,
    exclude_id: Option<i64>,
) -> Result<bool, sqlx::Error> {
    let existing: Option<i64> = match exclude_id {
        Some(folder_id) => {
            sqlx::query_scalar("SELECT id FROM folder WHERE name = ? AND id != ? LIMIT 1")
                .bind(name)
                .bind(folder_id)
                .fetch_optional(pool)
                .await?
        }
        None => {
            sqlx::query_scalar("SELECT id FROM folder WHERE name = ? LIMIT 1")
                .bind(name)
                .fetch_optional(pool)
                .await?
        }
    };

    Ok(existing.is_some())
}

/// Inserts a non-root folder and returns the new identifier.
pub async fn create_folder(pool: &SqlitePool, name: &str) -> Result<i64, sqlx::Error> {
    let result = sqlx::query("INSERT INTO folder (name, is_root) VALUES (?, 0)")
        .bind(name)
        .execute(pool)
        .await?;

    Ok(result.last_insert_rowid())
}

/// Updates a folder name.
pub async fn rename_folder(
    pool: &SqlitePool,
    folder_id: i64,
    name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE folder SET name = ? WHERE id = ?")
        .bind(name)
        .bind(folder_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Atomically deletes folder payloads and identities, retaining newsletter sender blocklists.
pub async fn delete_folder_cascade(
    pool: &SqlitePool,
    folder_id: i64,
) -> Result<FolderDeleteCounts, sqlx::Error> {
    let root_folder_id = get_root_folder_id(pool).await?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let deleted_articles = sqlx::query(
        "DELETE FROM article WHERE feed_id IN (SELECT id FROM feed WHERE folder_id = ?)",
    )
    .bind(folder_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    sqlx::query(
        "DELETE FROM article_identity WHERE feed_id IN (SELECT id FROM feed WHERE folder_id = ?)",
    )
    .bind(folder_id)
    .execute(&mut *tx)
    .await?;
    let deleted_regular_feeds =
        sqlx::query("DELETE FROM feed WHERE folder_id = ? AND is_mailing_list = 0")
            .bind(folder_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();
    let deleted_mailing_list_feeds = sqlx::query(
        "UPDATE feed
         SET deleted_at = CAST(strftime('%s','now') AS INTEGER),
             next_update_time = NULL,
             update_error_count = 0,
             last_update_error = NULL,
             folder_id = ?
         WHERE folder_id = ? AND is_mailing_list = 1 AND deleted_at IS NULL",
    )
    .bind(root_folder_id)
    .bind(folder_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let deleted_folders = sqlx::query("DELETE FROM folder WHERE id = ?")
        .bind(folder_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    tx.commit().await?;

    Ok(FolderDeleteCounts {
        deleted_articles,
        deleted_feeds: deleted_regular_feeds + deleted_mailing_list_feeds,
        deleted_folders,
    })
}

/// Marks unread folder items as read up to the boundary, leaving read items unchanged.
pub async fn mark_folder_items_read(
    pool: &SqlitePool,
    folder_id: i64,
    newest_item_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE article SET unread = 0, last_modified = CAST(strftime('%s','now') AS INTEGER) \
         WHERE feed_id IN (SELECT id FROM feed WHERE folder_id = ?) AND id <= ? AND unread = 1",
    )
    .bind(folder_id)
    .bind(newest_item_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Returns the root folder id, creating it for fresh databases when necessary.
pub async fn get_root_folder_id(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let id: Option<i64> = sqlx::query_scalar("SELECT id FROM folder WHERE is_root = 1 LIMIT 1")
        .fetch_optional(pool)
        .await?;

    if let Some(id) = id {
        return Ok(id);
    }

    let result = sqlx::query("INSERT INTO folder (name, is_root) VALUES ('', 1)")
        .execute(pool)
        .await?;
    Ok(result.last_insert_rowid())
}

/// Returns whether a feed with the given identifier exists.
pub async fn feed_exists(pool: &SqlitePool, feed_id: i64) -> Result<bool, sqlx::Error> {
    let existing: Option<i64> =
        sqlx::query_scalar("SELECT id FROM feed WHERE id = ? AND deleted_at IS NULL LIMIT 1")
            .bind(feed_id)
            .fetch_optional(pool)
            .await?;

    Ok(existing.is_some())
}

/// Returns whether a feed URL already exists.
pub async fn feed_exists_by_url(pool: &SqlitePool, url: &str) -> Result<bool, sqlx::Error> {
    let existing: Option<i64> =
        sqlx::query_scalar("SELECT id FROM feed WHERE url = ? AND deleted_at IS NULL LIMIT 1")
            .bind(url)
            .fetch_optional(pool)
            .await?;

    Ok(existing.is_some())
}

/// Returns the newest article id stored for a feed, if any.
pub async fn newest_article_id_for_feed(
    pool: &SqlitePool,
    feed_id: i64,
) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar("SELECT MAX(id) FROM article WHERE feed_id = ?")
        .bind(feed_id)
        .fetch_one(pool)
        .await
}

/// Updates the folder assignment for a feed.
pub async fn move_feed(pool: &SqlitePool, feed_id: i64, folder_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE feed SET folder_id = ? WHERE id = ? AND deleted_at IS NULL")
        .bind(folder_id)
        .bind(feed_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Updates the display title for a feed and returns the affected row count.
pub async fn rename_feed(pool: &SqlitePool, feed_id: i64, title: &str) -> Result<u64, sqlx::Error> {
    let result = sqlx::query("UPDATE feed SET title = ? WHERE id = ? AND deleted_at IS NULL")
        .bind(title)
        .bind(feed_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

/// Atomically deletes feed payloads and identities, retaining newsletter sender blocklists.
pub async fn delete_feed_cascade(
    pool: &SqlitePool,
    feed_id: i64,
) -> Result<FeedDeleteCounts, sqlx::Error> {
    let root_folder_id = get_root_folder_id(pool).await?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let is_mailing_list: bool =
        sqlx::query_scalar("SELECT is_mailing_list FROM feed WHERE id = ? AND deleted_at IS NULL")
            .bind(feed_id)
            .fetch_one(&mut *tx)
            .await?;
    let deleted_articles = sqlx::query("DELETE FROM article WHERE feed_id = ?")
        .bind(feed_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    sqlx::query("DELETE FROM article_identity WHERE feed_id = ?")
        .bind(feed_id)
        .execute(&mut *tx)
        .await?;
    let deleted_feeds = if is_mailing_list {
        sqlx::query(
            "UPDATE feed
             SET deleted_at = CAST(strftime('%s','now') AS INTEGER),
                 next_update_time = NULL,
                 update_error_count = 0,
                 last_update_error = NULL,
                 folder_id = ?
             WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(root_folder_id)
        .bind(feed_id)
        .execute(&mut *tx)
        .await?
        .rows_affected()
    } else {
        sqlx::query("DELETE FROM feed WHERE id = ?")
            .bind(feed_id)
            .execute(&mut *tx)
            .await?
            .rows_affected()
    };

    tx.commit().await?;

    Ok(FeedDeleteCounts {
        deleted_articles,
        deleted_feeds,
    })
}

/// Returns whether a mailing-list sender has been soft-deleted.
pub async fn mailing_list_sender_is_deleted(
    pool: &SqlitePool,
    from_address: &str,
) -> Result<bool, sqlx::Error> {
    let deleted_at: Option<Option<i64>> = sqlx::query_scalar(
        "SELECT deleted_at FROM feed WHERE url = ? AND is_mailing_list = 1 LIMIT 1",
    )
    .bind(from_address)
    .fetch_optional(pool)
    .await?;

    Ok(matches!(deleted_at, Some(Some(_))))
}

/// Marks unread feed items as read up to the boundary, leaving read items unchanged.
pub async fn mark_feed_items_read(
    pool: &SqlitePool,
    feed_id: i64,
    newest_item_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE article SET unread = 0, last_modified = CAST(strftime('%s','now') AS INTEGER) \
         WHERE feed_id = ? AND id <= ? AND unread = 1",
    )
    .bind(feed_id)
    .bind(newest_item_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Returns how many article ids from the provided list already exist.
pub async fn existing_article_count(
    pool: &SqlitePool,
    item_ids: &[i64],
) -> Result<i64, sqlx::Error> {
    let mut qb: QueryBuilder<'_, Sqlite> =
        QueryBuilder::new("SELECT COUNT(*) FROM article WHERE id IN (");
    {
        let mut separated = qb.separated(", ");
        for id in item_ids {
            separated.push_bind(*id);
        }
    }
    qb.push(")");

    qb.build_query_scalar().fetch_one(pool).await
}

/// Updates changed article flags only, preserving `last_modified` for no-op requests.
pub async fn update_article_flags(
    pool: &SqlitePool,
    item_ids: &[i64],
    flag: ArticleFlag,
    value: bool,
) -> Result<(), sqlx::Error> {
    let mut qb: QueryBuilder<'_, Sqlite> = QueryBuilder::new("UPDATE article SET ");
    qb.push(flag.column_name());
    qb.push(" = ");
    qb.push_bind(value);
    qb.push(", last_modified = CAST(strftime('%s','now') AS INTEGER) WHERE id IN (");
    {
        let mut separated = qb.separated(", ");
        for id in item_ids {
            separated.push_bind(*id);
        }
    }
    qb.push(") AND ");
    qb.push(flag.column_name());
    qb.push(" != ");
    qb.push_bind(value);

    qb.build().execute(pool).await?;
    Ok(())
}

/// Marks unread items as read up to the boundary, leaving read items unchanged.
pub async fn mark_all_items_read(
    pool: &SqlitePool,
    newest_item_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE article SET unread = 0, last_modified = CAST(strftime('%s','now') AS INTEGER) WHERE id <= ? AND unread = 1",
    )
    .bind(newest_item_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Inserts a mailing-list feed and returns the new identifier.
pub async fn create_mailing_list_feed(
    pool: &SqlitePool,
    from_address: &str,
    feed_title: &str,
    root_id: i64,
    now_ts: i64,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO feed (url, title, favicon_link, added, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, is_mailing_list, last_quality_check, use_extracted_fulltext, use_llm_summary) VALUES (?, ?, NULL, ?, NULL, ?, 0, NULL, 0, 0, NULL, 1, NULL, 0, 0)",
    )
    .bind(from_address)
    .bind(feed_title)
    .bind(now_ts)
    .bind(root_id)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

/// Advances the stored feed last-article timestamp when the candidate is newer.
pub async fn advance_feed_last_article_date<'e, E>(
    executor: E,
    feed_id: i64,
    candidate_timestamp: i64,
) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Sqlite>,
{
    sqlx::query(
        "UPDATE feed
         SET last_article_date = CASE
             WHEN last_article_date IS NULL OR last_article_date < ? THEN ?
             ELSE last_article_date
         END
         WHERE id = ?",
    )
    .bind(candidate_timestamp)
    .bind(candidate_timestamp)
    .bind(feed_id)
    .execute(executor)
    .await?;
    Ok(())
}

/// Inserts an article only for an active feed; concurrent GUID conflicts are no-ops.
pub async fn insert_article_record<'e, E>(
    executor: E,
    article: ArticleRecord,
) -> Result<bool, sqlx::Error>
where
    E: Executor<'e, Database = Sqlite>,
{
    let result = sqlx::query(
        "INSERT INTO article (title, content, author, content_hash, enclosure_link, enclosure_mime, feed_id, fingerprint, guid, guid_hash, last_modified, media_description, media_thumbnail, pub_date, rtl, starred, unread, updated_date, url, summary) SELECT ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, NULL, ?, ?, 0, ?, ?, ?, ?, ? FROM feed WHERE id = ? AND deleted_at IS NULL ON CONFLICT(guid_hash) DO NOTHING",
    )
    .bind(article.title)
    .bind(article.content)
    .bind(article.author)
    .bind(article.content_hash)
    .bind(article.feed_id)
    .bind(article.guid)
    .bind(&article.guid_hash)
    .bind(article.last_modified)
    .bind(article.media_thumbnail)
    .bind(article.pub_date)
    .bind(article.starred)
    .bind(article.unread)
    .bind(article.updated_date)
    .bind(article.url)
    .bind(article.summary)
    .bind(article.feed_id)
    .execute(executor)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Atomically refreshes observed identities before advancing a regular feed's success clock.
///
/// All payload identities are touched, including those beyond the article-ingestion cap.
/// Only processed hashes may recreate an identity removed by concurrent maintenance; unseen
/// articles beyond the cap remain eligible for future ingestion. Older overlapping refreshes
/// cannot move either timestamp backwards. Newsletter streams have no complete feed snapshot.
pub async fn record_successful_feed_refresh(
    pool: &SqlitePool,
    feed_id: i64,
    seen_hashes: &[String],
    processed_hashes: &[String],
    observed_at: i64,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let active: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM feed WHERE id = ? AND deleted_at IS NULL AND is_mailing_list = 0)",
    ).bind(feed_id).fetch_one(tx.as_mut()).await?;
    if !active {
        tx.commit().await?;
        return Ok(());
    }
    for hashes in processed_hashes.chunks(200) {
        let mut query: QueryBuilder<'_, Sqlite> =
            QueryBuilder::new("INSERT INTO article_identity(guid_hash, feed_id, last_seen_at) ");
        query.push_values(hashes, |mut values, hash| {
            values
                .push_bind(hash)
                .push_bind(feed_id)
                .push_bind(observed_at);
        });
        query.push(" ON CONFLICT(guid_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at WHERE article_identity.last_seen_at < excluded.last_seen_at");
        query.build().execute(tx.as_mut()).await?;
    }
    for hashes in seen_hashes.chunks(500) {
        let mut query: QueryBuilder<'_, Sqlite> =
            QueryBuilder::new("UPDATE article_identity SET last_seen_at = ");
        query
            .push_bind(observed_at)
            .push(" WHERE last_seen_at < ")
            .push_bind(observed_at)
            .push(" AND guid_hash IN (");
        let mut values = query.separated(", ");
        for hash in hashes {
            values.push_bind(hash);
        }
        query.push(")");
        query.build().execute(tx.as_mut()).await?;
    }
    sqlx::query("UPDATE feed SET last_successful_refresh_at = ? WHERE id = ? AND (last_successful_refresh_at IS NULL OR last_successful_refresh_at < ?)")
        .bind(observed_at).bind(feed_id).bind(observed_at).execute(tx.as_mut()).await?;
    tx.commit().await?;
    Ok(())
}
