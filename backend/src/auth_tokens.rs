//! Persistence helpers for issued browser authentication tokens.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::random;
use sqlx::SqlitePool;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthTokenRecord {
    pub token: String,
    pub username: String,
    pub expires_at: i64,
}

/// Creates and persists a new opaque browser token for the given user.
pub async fn create_token(
    pool: &SqlitePool,
    username: &str,
    ttl: Duration,
) -> Result<AuthTokenRecord, sqlx::Error> {
    let now = unix_timestamp_now();
    let expires_at = now + ttl.as_secs() as i64;
    let token = generate_token();

    sqlx::query(
        "INSERT INTO auth_token (token, username, issued_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&token)
    .bind(username)
    .bind(now)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(AuthTokenRecord {
        token,
        username: username.to_string(),
        expires_at,
    })
}

/// Returns the current token record when it exists and has not expired.
pub async fn find_active_token(
    pool: &SqlitePool,
    token: &str,
) -> Result<Option<AuthTokenRecord>, sqlx::Error> {
    delete_expired_tokens(pool).await?;

    let row = sqlx::query_as::<_, AuthTokenRow>(
        "SELECT token, username, expires_at FROM auth_token WHERE token = ? LIMIT 1",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Into::into))
}

/// Revokes a token immediately.
pub async fn revoke_token(pool: &SqlitePool, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM auth_token WHERE token = ?")
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}

/// Deletes expired tokens and returns the number of removed rows.
pub async fn delete_expired_tokens(pool: &SqlitePool) -> Result<u64, sqlx::Error> {
    let now = unix_timestamp_now();
    let result = sqlx::query("DELETE FROM auth_token WHERE expires_at <= ?")
        .bind(now)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

fn generate_token() -> String {
    let bytes: [u8; 32] = random();
    URL_SAFE_NO_PAD.encode(bytes)
}

fn unix_timestamp_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[derive(sqlx::FromRow)]
struct AuthTokenRow {
    token: String,
    username: String,
    expires_at: i64,
}

impl From<AuthTokenRow> for AuthTokenRecord {
    fn from(value: AuthTokenRow) -> Self {
        Self {
            token: value.token,
            username: value.username,
            expires_at: value.expires_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use sqlx::SqlitePool;

    use super::{create_token, delete_expired_tokens, find_active_token, revoke_token};

    async fn setup_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(
            "CREATE TABLE auth_token (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token VARCHAR NOT NULL UNIQUE,
                username VARCHAR NOT NULL,
                issued_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn create_token_persists_row() {
        let pool = setup_pool().await;

        let created = create_token(&pool, "reader", Duration::from_secs(60))
            .await
            .unwrap();

        let stored = find_active_token(&pool, &created.token).await.unwrap();
        assert_eq!(stored, Some(created));
    }

    #[tokio::test]
    async fn find_active_token_ignores_expired_rows() {
        let pool = setup_pool().await;
        sqlx::query(
            "INSERT INTO auth_token (token, username, issued_at, expires_at) VALUES (?, ?, ?, ?)",
        )
        .bind("expired-token")
        .bind("reader")
        .bind(100_i64)
        .bind(100_i64)
        .execute(&pool)
        .await
        .unwrap();

        let stored = find_active_token(&pool, "expired-token").await.unwrap();
        assert!(stored.is_none());
    }

    #[tokio::test]
    async fn revoke_token_removes_row() {
        let pool = setup_pool().await;
        let created = create_token(&pool, "reader", Duration::from_secs(60))
            .await
            .unwrap();

        revoke_token(&pool, &created.token).await.unwrap();

        let stored = find_active_token(&pool, &created.token).await.unwrap();
        assert!(stored.is_none());
    }

    #[tokio::test]
    async fn delete_expired_tokens_removes_only_expired_rows() {
        let pool = setup_pool().await;
        sqlx::query(
            "INSERT INTO auth_token (token, username, issued_at, expires_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
        )
        .bind("expired-token")
        .bind("reader")
        .bind(100_i64)
        .bind(100_i64)
        .bind("active-token")
        .bind("reader")
        .bind(100_i64)
        .bind(i64::MAX)
        .execute(&pool)
        .await
        .unwrap();

        let deleted = delete_expired_tokens(&pool).await.unwrap();
        assert_eq!(deleted, 1);

        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM auth_token")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(remaining, 1);
    }
}
