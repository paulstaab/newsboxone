//! Token issuance and authentication middleware for protected API routes.

use std::time::{Duration, Instant};

use axum::Json;
use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, Request, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};

use super::AppState;
use super::errors::{ApiResult, internal_error};
use crate::auth_tokens;

const SHORT_SESSION_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const REMEMBERED_SESSION_TTL: Duration = Duration::from_secs(30 * 24 * 60 * 60);
const AUTH_FAILURE_WINDOW: Duration = Duration::from_secs(15 * 60);
const AUTH_RETRY_AFTER: Duration = Duration::from_secs(60);
const AUTH_MAX_FAILURES: u32 = 5;

#[derive(Debug, Deserialize)]
pub(super) struct IssueTokenIn {
    username: String,
    password: String,
    #[serde(rename = "rememberDevice")]
    remember_device: bool,
}

#[derive(Debug, Serialize)]
pub(super) struct IssueTokenOut {
    token: String,
    #[serde(rename = "expiresAt")]
    expires_at: i64,
}

#[derive(Clone, Debug)]
pub(super) struct AuthenticatedToken {
    pub token: String,
    pub username: String,
}

/// Issues a browser token after validating submitted credentials.
pub(super) async fn issue_token(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<IssueTokenIn>,
) -> Response {
    if input.username.trim().is_empty() || input.password.is_empty() {
        return unauthorized_error("Not authenticated").into_response();
    }

    if state.config.auth_enabled() {
        let expected_username = state.config.username.as_deref().unwrap_or_default();
        let expected_password = state.config.password.as_deref().unwrap_or_default();

        let rate_limit_key = auth_rate_limit_key(&headers, &input.username);
        if is_auth_rate_limited(&state, &rate_limit_key) {
            return too_many_auth_attempts();
        }

        if input.username != expected_username || input.password != expected_password {
            record_auth_failure(&state, rate_limit_key);
            return unauthorized_error("Invalid authentication credentials").into_response();
        }

        reset_auth_failures(&state, &rate_limit_key);
    }

    let ttl = if input.remember_device {
        REMEMBERED_SESSION_TTL
    } else {
        SHORT_SESSION_TTL
    };
    let record = auth_tokens::create_token(&state.pool, input.username.trim(), ttl).await;

    let record = match record {
        Ok(record) => record,
        Err(error) => return internal_error(error).into_response(),
    };

    Json(IssueTokenOut {
        token: record.token,
        expires_at: record.expires_at,
    })
    .into_response()
}

fn auth_rate_limit_key(headers: &HeaderMap, username: &str) -> String {
    let client = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("unknown");

    format!("{}:{client}", username.trim().to_ascii_lowercase())
}

fn is_auth_rate_limited(state: &AppState, key: &str) -> bool {
    let now = Instant::now();
    state
        .auth_rate_limiter
        .prune_expired(AUTH_FAILURE_WINDOW, now);

    let Ok(attempts) = state.auth_rate_limiter.attempts.lock() else {
        return false;
    };

    attempts
        .get(key)
        .and_then(|record| record.blocked_until)
        .is_some_and(|blocked_until| blocked_until > now)
}

fn record_auth_failure(state: &AppState, key: String) {
    let now = Instant::now();
    let Ok(mut attempts) = state.auth_rate_limiter.attempts.lock() else {
        return;
    };

    let record = attempts.entry(key).or_insert(super::AuthAttemptRecord {
        failed_count: 0,
        first_failed_at: now,
        blocked_until: None,
    });

    if now.duration_since(record.first_failed_at) >= AUTH_FAILURE_WINDOW {
        record.failed_count = 0;
        record.first_failed_at = now;
        record.blocked_until = None;
    }

    record.failed_count += 1;
    if record.failed_count >= AUTH_MAX_FAILURES {
        record.blocked_until = Some(now + AUTH_RETRY_AFTER);
    }
}

fn reset_auth_failures(state: &AppState, key: &str) {
    if let Ok(mut attempts) = state.auth_rate_limiter.attempts.lock() {
        attempts.remove(key);
    }
}

fn too_many_auth_attempts() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::RETRY_AFTER, AUTH_RETRY_AFTER.as_secs().to_string())],
        Json(serde_json::json!({ "detail": "Too many authentication attempts" })),
    )
        .into_response()
}

/// Revokes the currently authenticated browser token.
pub(super) async fn logout(
    State(state): State<AppState>,
    authenticated: Option<axum::extract::Extension<AuthenticatedToken>>,
) -> ApiResult<StatusCode> {
    let Some(axum::extract::Extension(authenticated)) = authenticated else {
        return Err(unauthorized_error("Not authenticated"));
    };

    let _ = &authenticated.username;
    auth_tokens::revoke_token(&state.pool, &authenticated.token)
        .await
        .map_err(internal_error)?;
    Ok(StatusCode::OK)
}

/// Enforces optional bearer authentication when credentials are configured.
pub(super) async fn require_bearer_auth(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    if !state.config.auth_enabled() {
        return next.run(request).await;
    }

    let Some(auth_header) = request.headers().get(header::AUTHORIZATION) else {
        return unauthorized("Not authenticated");
    };

    let Ok(auth_header) = auth_header.to_str() else {
        return unauthorized("Invalid authentication credentials");
    };

    let Some(token) = auth_header.strip_prefix("Bearer ") else {
        return unauthorized("Invalid authentication credentials");
    };

    let token = token.trim();
    if token.is_empty() {
        return unauthorized("Invalid authentication credentials");
    }

    let record = match auth_tokens::find_active_token(&state.pool, token).await {
        Ok(Some(record)) => record,
        Ok(None) => return unauthorized("Invalid authentication credentials"),
        Err(error) => return internal_error(error).into_response(),
    };

    request.extensions_mut().insert(AuthenticatedToken {
        token: record.token,
        username: record.username,
    });

    next.run(request).await
}

fn unauthorized(message: &'static str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        [(header::WWW_AUTHENTICATE, "Bearer")],
        Json(serde_json::json!({ "detail": message })),
    )
        .into_response()
}

fn unauthorized_error(message: &'static str) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({ "detail": message })),
    )
}
