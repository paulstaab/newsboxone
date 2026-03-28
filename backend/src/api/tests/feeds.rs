use axum::Router;
use axum::body::Body;
use axum::http::Request;
use axum::http::header;
use axum::routing::{get, post};
use serde_json::Value;
use tower::ServiceExt;

use crate::api::app;

use super::support::{
    setup_pool, start_fixture_feed_server, state, state_with_openai, state_with_testing_mode,
};

#[tokio::test]
async fn feeds_endpoint_maps_root_folder_to_null() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .uri("/api/feeds")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["feeds"][0]["folderId"], Value::Null);
    assert_eq!(parsed["feeds"][0]["lastArticleDate"], 100);
    assert_eq!(parsed["feeds"][0]["useExtractedFulltext"], false);
    assert_eq!(parsed["feeds"][0]["useLlmSummary"], false);
    assert_eq!(
        parsed["feeds"][0]["manualUseExtractedFulltext"],
        Value::Null
    );
    assert_eq!(parsed["feeds"][0]["manualUseLlmSummary"], Value::Null);
    assert_eq!(parsed["feeds"][0]["lastQualityCheck"], Value::Null);
    assert_eq!(parsed["feeds"][0]["lastManualQualityOverride"], Value::Null);
}

#[tokio::test]
async fn add_feed_blocks_localhost_when_not_testing_mode() {
    let response = app(state_with_testing_mode(setup_pool().await, false))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"url":"http://127.0.0.1:9999/feed.xml","folderId":null}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 400);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["detail"], "Access to localhost is not allowed.");
}

#[tokio::test]
async fn add_feed_duplicate_returns_409() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"url":"https://example.com/rss","folderId":null}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 409);
}

#[tokio::test]
async fn add_feed_with_missing_folder_returns_422() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"url":"https://example.com/new.xml","folderId":9999}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 422);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["detail"], "Folder with ID 9999 does not exist");
}

#[tokio::test]
async fn delete_nonexistent_feed_returns_404() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/feeds/9999")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 404);
}

#[tokio::test]
async fn move_feed_with_missing_folder_returns_422() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/10/move")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"folderId":9999}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 422);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["detail"], "Folder with ID 9999 does not exist");
}

#[tokio::test]
async fn rename_feed_updates_title() {
    let pool = setup_pool().await;

    let response = app(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/10/rename")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"feedTitle":"Renamed feed"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let title: Option<String> = sqlx::query_scalar("SELECT title FROM feed WHERE id = 10")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(title.as_deref(), Some("Renamed feed"));
}

#[tokio::test]
async fn rename_feed_put_method_returns_405() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/feeds/10/rename")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"feedTitle":"Wrong Method"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 405);
}

#[tokio::test]
async fn mark_feed_items_read_put_method_returns_405() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/feeds/10/read")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"newestItemId":100}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 405);
}

#[tokio::test]
async fn mark_feed_items_read_updates_article() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/10/read")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"newestItemId":100}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn read_missing_feed_returns_404_with_detail() {
    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/9999/read")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"newestItemId":100}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 404);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["detail"], "Feed 9999 not found");
}

#[tokio::test]
async fn add_feed_success_returns_expected_payload_fields() {
    let feed_url = start_fixture_feed_server().await;

    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"url":"{feed_url}","folderId":0}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();

    let created_id = parsed["newestItemId"].as_i64().unwrap();
    let feeds = parsed["feeds"].as_array().unwrap();
    let created_feed = feeds
        .iter()
        .find(|feed| feed["id"].as_i64() == Some(created_id))
        .unwrap();

    assert_eq!(created_feed["url"], feed_url);
    assert_eq!(created_feed["title"], "Fixture Feed");
    assert_eq!(created_feed["link"], "http://example.org/");
    assert_eq!(created_feed["updateErrorCount"], 0);
    assert_eq!(created_feed["lastArticleDate"], 1_772_755_200);
    assert!(created_feed["nextUpdateTime"].as_i64().is_some());
    assert_eq!(created_feed["folderId"], Value::Null);
}

#[tokio::test]
async fn update_feed_quality_sets_manual_overrides_and_returns_updated_feed() {
    let pool = setup_pool().await;

    let response = app(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/10/quality")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"useExtractedFulltext":true,"useLlmSummary":false}"#,
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
    assert_eq!(parsed["feed"]["useExtractedFulltext"], true);
    assert_eq!(parsed["feed"]["useLlmSummary"], false);
    assert_eq!(parsed["feed"]["manualUseExtractedFulltext"], true);
    assert_eq!(parsed["feed"]["manualUseLlmSummary"], false);
    assert!(parsed["feed"]["lastQualityCheck"].as_i64().is_some());
    assert!(
        parsed["feed"]["lastManualQualityOverride"]
            .as_i64()
            .is_some()
    );

    let state_row: (bool, bool, Option<bool>, Option<bool>) = sqlx::query_as(
        "SELECT use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary FROM feed WHERE id = 10",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(state_row, (true, false, Some(true), Some(false)));
}

#[tokio::test]
async fn update_feed_quality_can_clear_one_attribute_back_to_automatic() {
    let pool = setup_pool().await;
    sqlx::query(
        "UPDATE feed SET use_extracted_fulltext = 1, manual_use_extracted_fulltext = 1, use_llm_summary = 0, manual_use_llm_summary = 0, last_quality_check = 1234, last_manual_quality_override = 1234 WHERE id = 10",
    )
    .execute(&pool)
    .await
    .unwrap();

    let response = app(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/10/quality")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"useExtractedFulltext":null}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["feed"]["manualUseExtractedFulltext"], Value::Null);
    assert_eq!(parsed["feed"]["manualUseLlmSummary"], false);
    assert_eq!(parsed["feed"]["useExtractedFulltext"], true);
    assert_eq!(parsed["feed"]["useLlmSummary"], false);
    assert_eq!(parsed["feed"]["lastQualityCheck"], 1234);
    assert!(
        parsed["feed"]["lastManualQualityOverride"]
            .as_i64()
            .is_some()
    );

    let state_row: (bool, bool, Option<bool>, Option<bool>, Option<i64>) = sqlx::query_as(
        "SELECT use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_quality_check FROM feed WHERE id = 10",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(state_row, (true, false, None, Some(false), Some(1234)));
}

#[tokio::test]
async fn update_feed_quality_reevaluate_clears_manual_overrides() {
    let pool = setup_pool().await;
    let feed_url = start_fixture_feed_server().await;
    sqlx::query("INSERT INTO feed (id, url, title, favicon_link, added, last_article_date, next_update_time, folder_id, ordering, link, pinned, update_error_count, last_update_error, is_mailing_list, last_quality_check, use_extracted_fulltext, use_llm_summary, manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override) VALUES (11, ?, 'Fixture Feed', NULL, 123, NULL, 9999, 1, 0, 'https://example.org', 0, 0, NULL, 0, 1234, 1, 0, 1, 0, 1234)")
        .bind(feed_url)
        .execute(&pool)
        .await
        .unwrap();

    let response = app(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds/11/quality")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"reevaluate":true}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["feed"]["manualUseExtractedFulltext"], Value::Null);
    assert_eq!(parsed["feed"]["manualUseLlmSummary"], Value::Null);
    assert_eq!(parsed["feed"]["lastManualQualityOverride"], Value::Null);
    assert!(parsed["feed"]["lastQualityCheck"].as_i64().is_some());

    let state_row: (Option<bool>, Option<bool>, Option<i64>, Option<i64>) = sqlx::query_as(
        "SELECT manual_use_extracted_fulltext, manual_use_llm_summary, last_manual_quality_override, next_update_time FROM feed WHERE id = 11",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(state_row, (None, None, None, Some(9999)));
}

#[tokio::test]
async fn add_feed_extracts_media_thumbnail_from_body_content() {
    let feed_url = start_fixture_feed_server().await;
    let pool = setup_pool().await;

    let response = app(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"url":"{feed_url}","folderId":0}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);

    let created_feed_id: i64 = sqlx::query_scalar("SELECT id FROM feed WHERE url = ?")
        .bind(&feed_url)
        .fetch_one(&pool)
        .await
        .unwrap();

    let thumbnail: Option<String> =
        sqlx::query_scalar("SELECT media_thumbnail FROM article WHERE feed_id = ? LIMIT 1")
            .bind(created_feed_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(
        thumbnail.as_deref(),
        Some("https://example.org/entry-thumb.jpg")
    );
}

#[tokio::test]
async fn add_feed_defers_quality_evaluation_until_later_updates() {
    let fixture_base_url = start_quality_deferral_fixture_server().await;
    let feed_url = format!("{fixture_base_url}/quality.xml");
    let pool = setup_pool().await;

    let response = app(state_with_openai(pool.clone(), &fixture_base_url))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"url":"{feed_url}","folderId":0}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);

    let created_feed_id: i64 = sqlx::query_scalar("SELECT id FROM feed WHERE url = ?")
        .bind(&feed_url)
        .fetch_one(&pool)
        .await
        .unwrap();

    let quality_state: (Option<i64>, bool, bool) = sqlx::query_as(
        "SELECT last_quality_check, use_extracted_fulltext, use_llm_summary FROM feed WHERE id = ?",
    )
    .bind(created_feed_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(quality_state.0, None);
    assert!(!quality_state.1);
    assert!(!quality_state.2);

    let article_state: (Option<String>, Option<String>) =
        sqlx::query_as("SELECT content, summary FROM article WHERE feed_id = ? LIMIT 1")
            .bind(created_feed_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        article_state.0.as_deref(),
        Some("<p>Short teaser only.</p>")
    );
    assert_eq!(
        article_state.1.as_deref(),
        Some("<p>Short teaser only.</p>")
    );
}

#[tokio::test]
async fn add_feed_unreadable_source_returns_422() {
    let feed_url = start_fixture_feed_server()
        .await
        .replace("/atom.xml", "/missing.xml");

    let response = app(state(setup_pool().await))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/feeds")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"url":"{feed_url}","folderId":0}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 422);
}

#[tokio::test]
async fn delete_feed_removes_associated_articles() {
    let pool = setup_pool().await;

    let response = app(state(pool.clone()))
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/feeds/10")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);

    let remaining_feed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feed WHERE id = 10")
        .fetch_one(&pool)
        .await
        .unwrap();
    let remaining_articles: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM article WHERE feed_id = 10")
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(remaining_feed, 0);
    assert_eq!(remaining_articles, 0);
}

async fn start_quality_deferral_fixture_server() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let base_url = format!("http://{addr}");

    let app = Router::new()
        .route(
            "/quality.xml",
            get({
                let base_url = base_url.clone();
                move || {
                    let body = format!(
                        r#"<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Quality Deferral Fixture</title>
  <link href="{base_url}/feed-home" />
  <updated>2026-03-09T00:00:00Z</updated>
  <id>tag:example.org,2026:quality-deferral</id>
  <entry>
    <title>Deferred Entry</title>
    <link href="{base_url}/articles/deferred-entry" />
    <id>tag:example.org,2026:deferred-entry</id>
    <updated>2026-03-09T00:00:00Z</updated>
    <content type="html"><![CDATA[<p>Short teaser only.</p>]]></content>
  </entry>
</feed>"#
                    );
                    async move { ([(header::CONTENT_TYPE, "application/atom+xml")], body) }
                }
            }),
        )
        .route(
            "/articles/deferred-entry",
            get(|| async {
                (
                    [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                    r#"<!doctype html>
<html>
  <body>
    <article>
      <p>This extracted article is intentionally much longer than the feed teaser so a quality check would enable extraction immediately if the create path still ran it.</p>
      <p>It also contains enough material to make a later AI summary worthwhile once the periodic updater evaluates this feed.</p>
    </article>
  </body>
</html>"#,
                )
            }),
        )
        .route(
            "/v1/chat/completions",
            post(|| async {
                (
                    [(header::CONTENT_TYPE, "application/json")],
                    r#"{"choices":[{"message":{"content":"{\"summary\":\"Fixture summary from mock LLM.\"}"}}]}"#,
                )
            }),
        );

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    base_url
}
