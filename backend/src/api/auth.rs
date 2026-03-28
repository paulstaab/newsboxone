//! Token issuance and authentication middleware for protected API routes.

use std::time::Duration;

use axum::Json;
use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};

use super::AppState;
use super::errors::{ApiResult, internal_error};
use crate::auth_tokens;

const SHORT_SESSION_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const REMEMBERED_SESSION_TTL: Duration = Duration::from_secs(30 * 24 * 60 * 60);

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
    Json(input): Json<IssueTokenIn>,
) -> ApiResult<Json<IssueTokenOut>> {
    if input.username.trim().is_empty() || input.password.is_empty() {
        return Err(unauthorized_error("Not authenticated"));
    }

    if state.config.auth_enabled() {
        let expected_username = state.config.username.as_deref().unwrap_or_default();
        let expected_password = state.config.password.as_deref().unwrap_or_default();

        if input.username != expected_username || input.password != expected_password {
            return Err(unauthorized_error("Invalid authentication credentials"));
        }
    }

    let ttl = if input.remember_device {
        REMEMBERED_SESSION_TTL
    } else {
        SHORT_SESSION_TTL
    };
    let record = auth_tokens::create_token(&state.pool, input.username.trim(), ttl)
        .await
        .map_err(internal_error)?;

    Ok(Json(IssueTokenOut {
        token: record.token,
        expires_at: record.expires_at,
    }))
}

/// Revokes the currently authenticated browser token.
pub(super) async fn logout(
    State(state): State<AppState>,
    axum::extract::Extension(authenticated): axum::extract::Extension<AuthenticatedToken>,
) -> ApiResult<StatusCode> {
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

    let Some(record) = auth_tokens::find_active_token(&state.pool, token)
        .await
        .ok()
        .flatten()
    else {
        return unauthorized("Invalid authentication credentials");
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
