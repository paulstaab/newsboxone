use axum::body::Body;
use axum::http::Request;
use tower::ServiceExt;

use crate::api::app;

use super::support::{setup_pool, state, state_with_cors_origins, state_with_testing_mode};

#[tokio::test]
async fn status_endpoint_returns_ok() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .uri("/api/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn testing_mode_cors_allows_any_origin() {
    let response = app(state_with_testing_mode(setup_pool().await, true))
        .oneshot(
            Request::builder()
                .uri("/api/status")
                .header("origin", "https://reader.example")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .unwrap(),
        "*"
    );
}

#[tokio::test]
async fn production_cors_without_origins_does_not_emit_wildcard() {
    let response = app(state_with_testing_mode(setup_pool().await, false))
        .oneshot(
            Request::builder()
                .uri("/api/status")
                .header("origin", "https://reader.example")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    assert!(
        response
            .headers()
            .get("access-control-allow-origin")
            .is_none()
    );
}

#[tokio::test]
async fn production_cors_allows_configured_origin() {
    let response = app(state_with_cors_origins(
        setup_pool().await,
        vec!["https://reader.example".to_string()],
    ))
    .oneshot(
        Request::builder()
            .uri("/api/status")
            .header("origin", "https://reader.example")
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(response.status(), 200);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .unwrap(),
        "https://reader.example"
    );
}
