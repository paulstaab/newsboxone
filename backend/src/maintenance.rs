//! Bounded database maintenance independent of feed and mailbox availability.

use sqlx::{QueryBuilder, Sqlite, SqlitePool};

use crate::{article_store, auth_tokens, config::ArticleRetention};

/// Maximum articles removed per transaction to keep the SQLite writer lock short.
pub const CLEANUP_BATCH_SIZE: i64 = 500;

/// Expires article payloads using configured retention, preserving identities and starred rows.
pub async fn cleanup_articles(
    pool: &SqlitePool,
    retention: &ArticleRetention,
) -> Result<u64, sqlx::Error> {
    cleanup_articles_at(pool, retention, article_store::unix_now()).await
}

/// Removes a deterministic batch at the supplied time, measured from `last_modified`.
pub async fn cleanup_articles_at(
    pool: &SqlitePool,
    retention: &ArticleRetention,
    now: i64,
) -> Result<u64, sqlx::Error> {
    let mut query: QueryBuilder<'_, Sqlite> = QueryBuilder::new(
        "DELETE FROM article WHERE id IN (SELECT id FROM (
            SELECT id, last_modified FROM article
            WHERE unread = 0 AND starred = 0 AND last_modified <= ",
    );
    query.push_bind(cutoff(now, retention.read_days));
    if let Some(days) = retention.unread_days {
        query.push(" UNION ALL SELECT id, last_modified FROM article WHERE unread = 1 AND starred = 0 AND last_modified <= ");
        query.push_bind(cutoff(now, days));
    }
    query.push(") ORDER BY last_modified, id LIMIT ");
    query.push_bind(CLEANUP_BATCH_SIZE);
    query.push(")");
    let result = query.build().execute(pool).await?;
    Ok(result.rows_affected())
}

/// Converts retention days to a safe timestamp cutoff, including explicit programmatic policies.
fn cutoff(now: i64, days: u64) -> i64 {
    now.saturating_sub(days.saturating_mul(86_400).min(i64::MAX as u64) as i64)
}

/// Deletes one batch of identities absent for 90 days relative to their feed's success clock.
///
/// Retained articles, newsletter identities, and feeds without successful observations are
/// protected. Failed fetches do not advance the clock, so outages cannot expire identities.
pub async fn cleanup_identities(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM article_identity WHERE guid_hash IN (
            SELECT identity.guid_hash FROM feed
            JOIN article_identity identity ON identity.feed_id = feed.id
            WHERE feed.deleted_at IS NULL AND feed.is_mailing_list = 0
              AND identity.last_seen_at < feed.last_successful_refresh_at - ?
              AND NOT EXISTS (SELECT 1 FROM article WHERE article.guid_hash = identity.guid_hash)
            ORDER BY feed.id, identity.last_seen_at, identity.guid_hash LIMIT ?
        )",
    )
    .bind(90 * 86_400_i64)
    .bind(CLEANUP_BATCH_SIZE)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Runs bounded payload/identity expiry and token cleanup without any remote I/O.
pub async fn run(pool: &SqlitePool, retention: &ArticleRetention) -> Result<(), sqlx::Error> {
    let mut articles_removed = 0;
    for _ in 0..10 {
        let removed = cleanup_articles(pool, retention).await?;
        articles_removed += removed;
        if removed < CLEANUP_BATCH_SIZE as u64 {
            break;
        }
        tokio::task::yield_now().await;
    }
    let mut identities_removed = 0;
    for _ in 0..10 {
        let removed = cleanup_identities(pool).await?;
        identities_removed += removed;
        if removed < CLEANUP_BATCH_SIZE as u64 {
            break;
        }
        tokio::task::yield_now().await;
    }
    let tokens_removed = auth_tokens::delete_expired_tokens(pool).await?;
    tracing::info!(
        articles_removed,
        tokens_removed,
        identities_removed,
        read_retention_days = retention.read_days,
        unread_retention_days = ?retention.unread_days,
        "database maintenance completed"
    );
    Ok(())
}
