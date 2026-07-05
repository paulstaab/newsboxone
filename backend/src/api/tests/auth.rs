use axum::body::Body;
use axum::http::Request;
use serde_json::Value;
use tower::ServiceExt;

use crate::api::app;

use super::support::{issue_test_token, setup_pool, state_with_auth};

const TEST_USERNAME: &str = "testuser";
const TEST_PASSWORD: &str = "testpass";

#[tokio::test]
async fn protected_endpoints_require_auth_when_configured() {
    let response = app(state_with_auth(setup_pool().await, "user", "pass"))
        .oneshot(
            Request::builder()
                .uri("/api/folders")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn protected_endpoints_reject_invalid_credentials() {
    let pool = setup_pool().await;

    let response = app(state_with_auth(pool, "testuser", "testpass"))
        .oneshot(
            Request::builder()
                .uri("/api/feeds")
                .header("authorization", "Bearer wrong-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 401);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["detail"], "Invalid authentication credentials");
}

#[tokio::test]
async fn protected_endpoints_accept_valid_credentials() {
    let pool = setup_pool().await;
    let ok = issue_test_token(&pool, "testuser").await;

    let response = app(state_with_auth(pool, "testuser", "testpass"))
        .oneshot(
            Request::builder()
                .uri("/api/feeds")
                .header("authorization", format!("Bearer {ok}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn token_issuance_returns_token_for_valid_credentials() {
    let response = app(state_with_auth(setup_pool().await, "testuser", "testpass"))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/token")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "username": "testuser",
                        "password": "testpass",
                        "rememberDevice": true
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert!(parsed["token"].as_str().is_some());
    assert!(parsed["expiresAt"].as_i64().is_some());
}

#[tokio::test]
async fn token_issuance_rejects_invalid_credentials() {
    let response = app(state_with_auth(
        setup_pool().await,
        TEST_USERNAME,
        TEST_PASSWORD,
    ))
    .oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/auth/token")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "username": TEST_USERNAME,
                    "password": "wrongpass",
                    "rememberDevice": false
                })
                .to_string(),
            ))
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn logout_revokes_current_token() {
    let pool = setup_pool().await;
    let token = issue_test_token(&pool, TEST_USERNAME).await;
    let app = app(state_with_auth(pool, TEST_USERNAME, TEST_PASSWORD));

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/logout")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);

    let follow_up = app
        .oneshot(
            Request::builder()
                .uri("/api/feeds")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(follow_up.status(), 401);
}

#[tokio::test]
async fn token_issuance_rate_limits_repeated_invalid_credentials() {
    let app = app(state_with_auth(
        setup_pool().await,
        TEST_USERNAME,
        TEST_PASSWORD,
    ));

    for attempt in 1..=5 {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/token")
                    .header("content-type", "application/json")
                    .header("x-forwarded-for", "203.0.113.10")
                    .body(Body::from(
                        serde_json::json!({
                            "username": TEST_USERNAME,
                            "password": format!("wrongpass-{attempt}"),
                            "rememberDevice": false
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 401);
    }

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/token")
                .header("content-type", "application/json")
                .header("x-forwarded-for", "203.0.113.10")
                .body(Body::from(
                    serde_json::json!({
                        "username": TEST_USERNAME,
                        "password": "wrongpass-final",
                        "rememberDevice": false
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 429);
    assert_eq!(response.headers().get("retry-after").unwrap(), "60");
}
