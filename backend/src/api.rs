//! HTTP API composition for the Rust RSS aggregation service.

use std::sync::Arc;
use std::time::Instant;

use axum::body::Body;
use axum::extract::State;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Serialize;
use sqlx::SqlitePool;
use tower_http::cors::CorsLayer;

use crate::config::Config;

mod auth;
mod errors;
mod feeds;
mod folders;
mod items;

/// Shared application state injected into every API handler.
///
/// Separate feed and article HTTP clients are kept here so handlers and background
/// work can reuse the same client configuration without rebuilding clients per request.
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Arc<Config>,
    pub feed_http_client: reqwest::Client,
    pub article_http_client: reqwest::Client,
}

#[derive(Serialize)]
struct StatusOut {
    status: &'static str,
}

#[derive(Serialize)]
struct VersionOut {
    version: String,
}

/// Builds the full Axum router for the public API surface.
pub fn app(state: AppState) -> Router {
    let public_api = Router::new()
        .route("/auth/token", post(auth::issue_token))
        .merge(protected_router(state.clone()));

    Router::new()
        .route("/api/status", get(status))
        .nest("/api", public_api)
        .layer(axum::middleware::from_fn(log_user_interaction))
        .with_state(state)
        .layer(CorsLayer::permissive())
}

/// Builds the protected public API router.
fn protected_router(state_for_middleware: AppState) -> Router<AppState> {
    let router = Router::new()
        .route("/auth/logout", post(auth::logout))
        .route("/feeds", get(feeds::get_feeds))
        .route("/feeds", axum::routing::post(feeds::add_feed))
        .route(
            "/feeds/{feed_id}",
            axum::routing::delete(feeds::delete_feed),
        )
        .route("/folders", get(folders::get_folders))
        .route("/folders", axum::routing::post(folders::create_folder))
        .route(
            "/folders/{folder_id}",
            axum::routing::delete(folders::delete_folder),
        )
        .route(
            "/folders/{folder_id}",
            axum::routing::put(folders::rename_folder),
        )
        .route(
            "/folders/{folder_id}/read",
            axum::routing::post(folders::mark_folder_items_read),
        )
        .route("/items", get(items::get_items))
        .route("/items/updated", get(items::get_updated_items))
        .route("/items/{item_id}/content", get(items::get_item_content))
        .route("/version", get(get_version))
        .route(
            "/feeds/{feed_id}/move",
            axum::routing::post(feeds::move_feed),
        )
        .route(
            "/feeds/{feed_id}/rename",
            axum::routing::post(feeds::rename_feed),
        )
        .route(
            "/feeds/{feed_id}/read",
            axum::routing::post(feeds::mark_feed_items_read),
        )
        .route(
            "/feeds/{feed_id}/quality",
            axum::routing::post(feeds::update_feed_quality),
        )
        .route(
            "/items/{item_id}/read",
            axum::routing::post(items::mark_item_as_read),
        )
        .route(
            "/items/read/multiple",
            axum::routing::post(items::mark_multiple_items_as_read),
        )
        .route(
            "/items/{item_id}/unread",
            axum::routing::post(items::mark_item_as_unread),
        )
        .route(
            "/items/unread/multiple",
            axum::routing::post(items::mark_multiple_items_as_unread),
        )
        .route(
            "/items/star/multiple",
            axum::routing::post(items::mark_multiple_items_as_starred),
        )
        .route(
            "/items/{item_id}/star",
            axum::routing::post(items::mark_item_as_starred),
        )
        .route(
            "/items/{item_id}/unstar",
            axum::routing::post(items::mark_item_as_unstarred),
        )
        .route(
            "/items/unstar/multiple",
            axum::routing::post(items::mark_multiple_items_as_unstarred),
        )
        .route(
            "/items/read",
            axum::routing::post(items::mark_all_items_as_read),
        );

    router.route_layer(axum::middleware::from_fn_with_state(
        state_for_middleware,
        auth::require_bearer_auth,
    ))
}

/// Logs each incoming API request together with the response status and duration.
async fn log_user_interaction(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let started_at = Instant::now();
    let response = next.run(request).await;
    let duration_ms = started_at.elapsed().as_millis() as u64;

    tracing::info!(
        method = %method,
        uri = %uri,
        status = response.status().as_u16(),
        duration_ms,
        "request"
    );

    response
}

/// Returns the unauthenticated service health check response.
async fn status() -> Json<StatusOut> {
    Json(StatusOut { status: "ok" })
}

/// Returns the configured application version for the public API.
async fn get_version(State(state): State<AppState>) -> Json<VersionOut> {
    Json(VersionOut {
        version: state.config.version.clone(),
    })
}

#[cfg(test)]
mod tests;
