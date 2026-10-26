//! Integration coverage for database lifecycle, migrations, and concurrent persistence.

use sqlx::SqlitePool;

use crate::article_store::ArticleRecord;
use crate::config::ArticleRetention;
use crate::{auth_tokens, db, maintenance, repo};

/// Seeds one feed using the production schema.
async fn seed_feed(pool: &SqlitePool, mailing_list: bool) {
    sqlx::query("INSERT INTO feed(id,url,added,folder_id,is_mailing_list) VALUES(1,'https://example.test/feed',0,0,?)")
        .bind(mailing_list).execute(pool).await.unwrap();
}

/// Builds an old, read, unstarred article draft.
fn article(guid: &str) -> ArticleRecord {
    ArticleRecord {
        title: Some(guid.into()),
        content: Some("full text".into()),
        author: None,
        summary: Some("summary".into()),
        content_hash: None,
        feed_id: 1,
        guid: guid.into(),
        guid_hash: guid.into(),
        last_modified: 1,
        media_thumbnail: None,
        pub_date: Some(1),
        updated_date: Some(1),
        url: None,
        starred: false,
        unread: false,
    }
}

#[tokio::test]
async fn tc_db_002_mark_read_preserves_already_read_timestamps_and_boundaries() {
    for scope in 0..4 {
        let pool = db::create_memory_pool().await.unwrap();
        seed_feed(&pool, false).await;
        for guid in ["read", "unread", "above-boundary"] {
            repo::insert_article_record(&pool, article(guid))
                .await
                .unwrap();
        }
        sqlx::query("UPDATE article SET unread = 1 WHERE id IN (2,3)")
            .execute(&pool)
            .await
            .unwrap();
        match scope {
            0 => repo::mark_feed_items_read(&pool, 1, 2).await.unwrap(),
            1 => repo::mark_folder_items_read(&pool, 0, 2).await.unwrap(),
            2 => repo::mark_all_items_read(&pool, 2).await.unwrap(),
            _ => repo::update_article_flags(&pool, &[1, 2], repo::ArticleFlag::Unread, false)
                .await
                .unwrap(),
        }
        let rows: Vec<(i64, i64)> =
            sqlx::query_as("SELECT unread,last_modified FROM article ORDER BY id")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(rows[0], (0, 1));
        assert_eq!(rows[1].0, 0);
        assert!(rows[1].1 > 1);
        assert_eq!(rows[2], (1, 1));
        // Repeat against an already-read article, including an unchanged star flag.
        repo::update_article_flags(&pool, &[1], repo::ArticleFlag::Unread, false)
            .await
            .unwrap();
        repo::update_article_flags(&pool, &[1], repo::ArticleFlag::Starred, false)
            .await
            .unwrap();
        let timestamp: i64 = sqlx::query_scalar("SELECT last_modified FROM article WHERE id=1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(timestamp, 1);
    }
}

#[tokio::test]
async fn tc_db_003_concurrent_duplicates_and_deletion_are_serialized() {
    let temp = tempfile::tempdir().unwrap();
    let pool = db::create_pool(temp.path().join("test.sqlite").to_str().unwrap())
        .await
        .unwrap();
    seed_feed(&pool, true).await;
    let (a, b) = tokio::join!(
        repo::insert_article_record(&pool, article("duplicate")),
        repo::insert_article_record(&pool, article("duplicate"))
    );
    assert_ne!(a.unwrap(), b.unwrap());
    let (deleted, inserted) = tokio::join!(
        repo::delete_feed_cascade(&pool, 1),
        repo::insert_article_record(&pool, article("in-flight"))
    );
    deleted.unwrap();
    inserted.unwrap();
    assert!(
        !repo::insert_article_record(&pool, article("after-delete"))
            .await
            .unwrap()
    );
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM article")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    assert!(
        repo::mailing_list_sender_is_deleted(&pool, "https://example.test/feed")
            .await
            .unwrap()
    );
    pool.close().await;
}

#[tokio::test]
async fn tc_db_004_cascades_roll_back_on_parent_delete_failure() {
    for folder in [false, true] {
        let pool = db::create_memory_pool().await.unwrap();
        seed_feed(&pool, false).await;
        if folder {
            sqlx::query("INSERT INTO folder(id,name) VALUES(2,'test')")
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("UPDATE feed SET folder_id=2")
                .execute(&pool)
                .await
                .unwrap();
        }
        repo::insert_article_record(&pool, article("keep"))
            .await
            .unwrap();
        let table = if folder { "folder" } else { "feed" };
        sqlx::raw_sql(&format!("CREATE TRIGGER fail_delete BEFORE DELETE ON {table} BEGIN SELECT RAISE(ABORT, 'injected failure'); END")).execute(&pool).await.unwrap();
        if folder {
            assert!(repo::delete_folder_cascade(&pool, 2).await.is_err());
        } else {
            assert!(repo::delete_feed_cascade(&pool, 1).await.is_err());
        }
        // Pool acquisition waits for the failed transaction's rollback.
        let counts: (i64, i64, i64) =
            sqlx::query_as("SELECT (SELECT COUNT(*) FROM feed),(SELECT COUNT(*) FROM article),(SELECT COUNT(*) FROM article_identity)")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(counts, (1, 1, 1));
        assert!(
            sqlx::query("PRAGMA foreign_key_check")
                .fetch_all(&pool)
                .await
                .unwrap()
                .is_empty()
        );
    }
}

#[tokio::test]
async fn tc_db_005_tc_pipe_026_cleanup_is_bounded_and_independent_of_remote_work() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    for guid in ["payload", "unread", "starred", "recent"] {
        let mut record = article(guid);
        record.unread = guid == "unread";
        record.starred = guid == "starred";
        if guid == "recent" {
            record.last_modified = crate::article_store::unix_now();
        }
        repo::insert_article_record(&pool, record).await.unwrap();
    }
    // Broken and not-due feeds must both be cleaned without calling a remote endpoint.
    sqlx::query("UPDATE feed SET update_error_count=10,next_update_time=9223372036854775807")
        .execute(&pool)
        .await
        .unwrap();
    for i in 0..maintenance::CLEANUP_BATCH_SIZE + 1 {
        repo::insert_article_record(&pool, article(&format!("stale-{i}")))
            .await
            .unwrap();
    }
    assert_eq!(
        maintenance::cleanup_articles(&pool, &ArticleRetention::default())
            .await
            .unwrap(),
        maintenance::CLEANUP_BATCH_SIZE as u64
    );
    assert_eq!(
        maintenance::cleanup_articles(&pool, &ArticleRetention::default())
            .await
            .unwrap(),
        2
    );
    let remaining: Vec<String> = sqlx::query_scalar("SELECT guid FROM article ORDER BY id")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(remaining, ["unread", "starred", "recent"]);
    // Newsletter payloads follow the same retention policy as regular feeds.
    sqlx::query("UPDATE feed SET is_mailing_list=1")
        .execute(&pool)
        .await
        .unwrap();
    repo::insert_article_record(&pool, article("newsletter"))
        .await
        .unwrap();
    sqlx::query("INSERT INTO auth_token(token,username,issued_at,expires_at) VALUES('expired','reader',0,1)").execute(&pool).await.unwrap();
    maintenance::run(&pool, &ArticleRetention::default())
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article WHERE guid='newsletter'")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM auth_token")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn tc_db_006_token_validation_does_not_delete_rows() {
    let pool = db::create_memory_pool().await.unwrap();
    sqlx::query("INSERT INTO auth_token(token,username,issued_at,expires_at) VALUES('expired','reader',0,1),('active','reader',0,9223372036854775807)").execute(&pool).await.unwrap();
    // A DELETE would fail, including a sweep that found no rows to remove.
    sqlx::raw_sql("CREATE TRIGGER reject_token_delete BEFORE DELETE ON auth_token BEGIN SELECT RAISE(ABORT,'read path wrote'); END").execute(&pool).await.unwrap();
    assert!(
        auth_tokens::find_active_token(&pool, "expired")
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        auth_tokens::find_active_token(&pool, "active")
            .await
            .unwrap()
            .is_some()
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM auth_token")
            .fetch_one(&pool)
            .await
            .unwrap(),
        2
    );
}

#[tokio::test]
async fn tc_db_007_legacy_duplicates_migrate_with_flags_and_indexes() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    let migrator = sqlx::migrate!("./migrations");
    for migration in migrator.iter().filter(|m| m.version < 202610260001) {
        sqlx::raw_sql(&migration.sql).execute(&pool).await.unwrap();
    }
    seed_feed(&pool, false).await;
    sqlx::query("INSERT INTO article(id,feed_id,guid,guid_hash,last_modified,starred,unread) VALUES(1,1,'a','same',1,1,0),(2,1,'b','same',20,0,1)").execute(&pool).await.unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/202610260001_article_health.sql"
    ))
    .execute(&pool)
    .await
    .unwrap();
    let last_seen_at: i64 =
        sqlx::query_scalar("SELECT last_seen_at FROM article_identity WHERE guid_hash='same'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(last_seen_at > 0 && last_seen_at <= crate::article_store::unix_now());
    let rows: Vec<(i64, i64, i64, i64)> =
        sqlx::query_as("SELECT id,starred,unread,last_modified FROM article")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(rows, [(1, 1, 1, 20)]);
    assert!(
        !repo::insert_article_record(&pool, article("same"))
            .await
            .unwrap()
    );
    for (query, index) in [
        (
            "SELECT id FROM article WHERE guid_hash='missing'",
            "idx_article_guid_hash",
        ),
        (
            "SELECT id FROM article WHERE feed_id=1 ORDER BY id DESC LIMIT 100",
            "idx_article_feed_id_id",
        ),
        (
            "SELECT COUNT(*) FROM article WHERE feed_id=1 AND pub_date>1",
            "idx_article_feed_pub_date",
        ),
        (
            "SELECT id FROM article WHERE unread=0 AND starred=0 AND last_modified<100 ORDER BY last_modified,id LIMIT 500",
            "idx_article_retention",
        ),
    ] {
        let plan: Vec<(i64, i64, i64, String)> =
            sqlx::query_as(&format!("EXPLAIN QUERY PLAN {query}"))
                .fetch_all(&pool)
                .await
                .unwrap();
        assert!(plan.iter().any(|row| row.3.contains(index)), "{plan:?}");
    }
    let migrated: (i64, i64, i64, i64) =
        sqlx::query_as("SELECT id,starred,unread,last_modified FROM article")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(migrated, (1, 1, 1, 20));
    assert!(
        crate::article_store::article_exists_by_guid_hash(&pool, "same")
            .await
            .unwrap()
    );
    sqlx::query("DELETE FROM article")
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        !repo::insert_article_record(&pool, article("same"))
            .await
            .unwrap()
    );
    assert!(
        repo::insert_article_record(&pool, article("new-identity"))
            .await
            .unwrap()
    );
    assert!(
        sqlx::query_scalar::<_, i64>("SELECT id FROM article")
            .fetch_one(&pool)
            .await
            .unwrap()
            > 1
    );
    assert!(
        sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn tc_db_008_expired_payload_is_not_reingested() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    let parsed = feed_rs::parser::parse(br#"<feed xmlns="http://www.w3.org/2005/Atom"><id>test-feed</id><title>Test</title><updated>2026-01-01T00:00:00Z</updated><entry><id>payload</id><title>Payload</title><updated>2026-01-01T00:00:00Z</updated></entry></feed>"#.as_slice()).unwrap();
    let config = crate::config::Config {
        article_retention: ArticleRetention::default(),
        ..crate::config::Config::from_env()
    };
    let client = reqwest::Client::new();
    let context = crate::feed_ingestion::FeedEntryIngestionContext {
        pool: &pool,
        article_http_client: &client,
        config: &config,
        feed_id: 1,
        feed_url: "https://example.test/feed",
        content_state: crate::content::FeedContentState {
            last_quality_check: None,
            use_extracted_fulltext: false,
            use_llm_summary: false,
            manual_use_extracted_fulltext: None,
            manual_use_llm_summary: None,
        },
    };
    let first = crate::feed_ingestion::ingest_feed_entries(&context, &parsed.entries)
        .await
        .unwrap();
    assert_eq!(first.inserted, 1);
    let last_seen_at: i64 = sqlx::query_scalar("SELECT last_seen_at FROM article_identity")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(last_seen_at > 0 && last_seen_at <= crate::article_store::unix_now());
    sqlx::query("UPDATE article_identity SET last_seen_at=1")
        .execute(&pool)
        .await
        .unwrap();
    let again = crate::feed_ingestion::ingest_feed_entries(&context, &parsed.entries)
        .await
        .unwrap();
    assert_eq!(again.inserted, 0);
    sqlx::query("UPDATE article SET unread=0,last_modified=1")
        .execute(&pool)
        .await
        .unwrap();
    // Keep the real background schedule independent from this explicit maintenance call.
    crate::maintenance::run(&pool, &config.article_retention)
        .await
        .unwrap();
    // This source is rejected by SSRF validation, so the test needs no HTTP fixture.
    sqlx::query("UPDATE feed SET url='http://127.0.0.1/feed',next_update_time=0")
        .execute(&pool)
        .await
        .unwrap();
    crate::updater::update_due_feeds(&pool, &config, false)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT update_error_count FROM feed")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        maintenance::cleanup_articles(&pool, &ArticleRetention::default())
            .await
            .unwrap(),
        0
    );
    let expired = crate::feed_ingestion::ingest_feed_entries(&context, &parsed.entries)
        .await
        .unwrap();
    assert_eq!(expired.inserted, 0);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article_identity")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert!(
        sqlx::query_scalar::<_, i64>("SELECT last_seen_at FROM article_identity")
            .fetch_one(&pool)
            .await
            .unwrap()
            > 1
    );
}

#[tokio::test]
async fn tc_db_009_retention_defaults_boundaries_and_unread_opt_in() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    let day = 86_400;
    let now = 100 * day;
    // Publication dates are irrelevant; retention is based only on last_modified.
    for (guid, changed, unread, starred) in [
        ("read-at-30d", now - 30 * day, false, false),
        ("read-before-30d", now - 30 * day + 1, false, false),
        ("unread-old", 1, true, false),
        ("starred-read", 1, false, true),
        ("starred-unread", 1, true, true),
    ] {
        let mut record = article(guid);
        record.last_modified = changed;
        record.unread = unread;
        record.starred = starred;
        repo::insert_article_record(&pool, record).await.unwrap();
    }
    let defaults = ArticleRetention::default();
    assert_eq!(
        maintenance::cleanup_articles_at(&pool, &defaults, now)
            .await
            .unwrap(),
        1
    );
    assert!(
        !repo::insert_article_record(&pool, article("read-at-30d"))
            .await
            .unwrap()
    );
    assert_eq!(
        maintenance::cleanup_articles_at(&pool, &defaults, now + 1)
            .await
            .unwrap(),
        1
    );
    let custom = ArticleRetention {
        read_days: 7,
        unread_days: Some(60),
    };
    let mut record = article("read-at-7d");
    record.last_modified = now - 7 * day;
    repo::insert_article_record(&pool, record).await.unwrap();
    assert_eq!(
        maintenance::cleanup_articles_at(&pool, &custom, now)
            .await
            .unwrap(),
        2
    );
    let remaining: Vec<String> = sqlx::query_scalar("SELECT guid FROM article ORDER BY id")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(remaining, ["starred-read", "starred-unread"]);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article_identity")
            .fetch_one(&pool)
            .await
            .unwrap(),
        6
    );
    // Explicit unsubscribe releases identity records too; a new subscription can ingest again.
    repo::delete_feed_cascade(&pool, 1).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article_identity")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    seed_feed(&pool, false).await;
    assert!(
        repo::insert_article_record(&pool, article("read-at-30d"))
            .await
            .unwrap()
    );
}

#[tokio::test]
async fn tc_db_010_identity_insert_rolls_back_with_payload_failure() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    // Failure after payload insertion must not poison future duplicate checks.
    sqlx::raw_sql("CREATE TRIGGER reject_payload AFTER INSERT ON article BEGIN SELECT RAISE(ABORT,'injected persistence failure'); END").execute(&pool).await.unwrap();
    assert!(
        repo::insert_article_record(&pool, article("retry"))
            .await
            .is_err()
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article_identity")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    sqlx::query("DROP TRIGGER reject_payload")
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        repo::insert_article_record(&pool, article("retry"))
            .await
            .unwrap()
    );
    assert!(
        crate::article_store::article_exists_by_guid_hash(&pool, "retry")
            .await
            .unwrap()
    );
}

#[tokio::test]
async fn tc_db_011_feed_refresh_does_not_run_an_extra_retention_sweep() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    repo::insert_article_record(&pool, article("await-hourly-sweep"))
        .await
        .unwrap();
    sqlx::query("UPDATE feed SET next_update_time=9223372036854775807")
        .execute(&pool)
        .await
        .unwrap();
    let config = crate::config::Config {
        article_retention: ArticleRetention::default(),
        ..crate::config::Config::from_env()
    };
    crate::updater::update_due_feeds(&pool, &config, false)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    maintenance::run(&pool, &config.article_retention)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM article")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn tc_db_012_identity_expiry_uses_successful_feed_time_and_protects_retained_articles() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    let day = 86_400;
    let now = crate::article_store::unix_now();
    let old_success = now - 200 * day;
    for guid in ["absent", "boundary", "retained"] {
        repo::insert_article_record(&pool, article(guid))
            .await
            .unwrap();
    }
    sqlx::query("DELETE FROM article WHERE guid != 'retained'")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE article_identity SET last_seen_at=?")
        .bind(old_success - 10 * day)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE feed SET last_successful_refresh_at=?,url='http://127.0.0.1/feed',next_update_time=0")
        .bind(old_success).execute(&pool).await.unwrap();
    let config = crate::config::Config::from_env();
    crate::updater::update_due_feeds(&pool, &config, false)
        .await
        .unwrap();
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 0);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT last_successful_refresh_at FROM feed")
            .fetch_one(&pool)
            .await
            .unwrap(),
        old_success
    );
    // Recovery refresh observes one returning identity before advancing the cutoff.
    sqlx::query("UPDATE article_identity SET last_seen_at=? WHERE guid_hash='boundary'")
        .bind(now - 90 * day)
        .execute(&pool)
        .await
        .unwrap();
    repo::record_successful_feed_refresh(&pool, 1, &["absent".into()], &["absent".into()], now)
        .await
        .unwrap();
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 0);
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT last_seen_at FROM article_identity WHERE guid_hash='absent'"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        now
    );
    // Exactly 90 days remains protected; older and without payload becomes eligible.
    repo::record_successful_feed_refresh(&pool, 1, &[], &[], now + 1)
        .await
        .unwrap();
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 1);
    assert!(
        crate::article_store::article_exists_by_guid_hash(&pool, "retained")
            .await
            .unwrap()
    );
    // A retained payload still prevents identity deletion after a long absence.
    sqlx::query("DELETE FROM article")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 1);
    // Missing success clocks and newsletter streams cannot expire unseen identities.
    sqlx::query("UPDATE article_identity SET last_seen_at=1")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE feed SET last_successful_refresh_at=NULL")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 0);
    sqlx::query("UPDATE feed SET is_mailing_list=1,last_successful_refresh_at=?")
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 0);
}

#[tokio::test]
async fn tc_db_013_successful_payload_touches_identities_beyond_ingestion_cap() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    let mut xml = String::from(
        "<feed xmlns='http://www.w3.org/2005/Atom'><id>feed</id><title>Feed</title><updated>2026-01-01T00:00:00Z</updated>",
    );
    for i in 0..52 {
        let guid = format!("entry-{i}");
        xml.push_str(&format!("<entry><id>{guid}</id><title>Entry</title><updated>2026-01-01T00:00:00Z</updated></entry>"));
        if i < 51 {
            let mut record = article(&guid);
            record.guid_hash = crate::article_store::guid_hash(&guid);
            repo::insert_article_record(&pool, record).await.unwrap();
        }
    }
    xml.push_str("</feed>");
    sqlx::query("DELETE FROM article")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE article_identity SET last_seen_at=1")
        .execute(&pool)
        .await
        .unwrap();
    let parsed = feed_rs::parser::parse(xml.as_bytes()).unwrap();
    let config = crate::config::Config::from_env();
    let client = reqwest::Client::new();
    let context = crate::feed_ingestion::FeedEntryIngestionContext {
        pool: &pool,
        article_http_client: &client,
        config: &config,
        feed_id: 1,
        feed_url: "https://example.test/feed",
        content_state: crate::content::FeedContentState {
            last_quality_check: None,
            use_extracted_fulltext: false,
            use_llm_summary: false,
            manual_use_extracted_fulltext: None,
            manual_use_llm_summary: None,
        },
    };
    let stats = crate::feed_ingestion::ingest_feed_entries(&context, &parsed.entries)
        .await
        .unwrap();
    assert_eq!(stats.processed, 50);
    assert_eq!(stats.inserted, 0);
    let clock: i64 = sqlx::query_scalar("SELECT last_successful_refresh_at FROM feed")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(clock > 1);
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM article_identity WHERE last_seen_at >= ?"
        )
        .bind(clock)
        .fetch_one(&pool)
        .await
        .unwrap(),
        51
    );
    assert!(
        !crate::article_store::article_exists_by_guid_hash(
            &pool,
            &crate::article_store::guid_hash("entry-51")
        )
        .await
        .unwrap()
    );
    // Clock rollback or overlapping older work cannot age currently seen identities.
    repo::record_successful_feed_refresh(&pool, 1, &[], &[], 1)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT last_successful_refresh_at FROM feed")
            .fetch_one(&pool)
            .await
            .unwrap(),
        clock
    );
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 0);
}

#[tokio::test]
async fn tc_db_014_identity_observations_and_success_clock_roll_back_together() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    repo::insert_article_record(&pool, article("seen"))
        .await
        .unwrap();
    sqlx::query("UPDATE article_identity SET last_seen_at=1")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE feed SET last_successful_refresh_at=1")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::raw_sql("CREATE TRIGGER fail_refresh_clock BEFORE UPDATE OF last_successful_refresh_at ON feed BEGIN SELECT RAISE(ABORT,'injected refresh failure'); END").execute(&pool).await.unwrap();
    let hashes = vec!["seen".into(), "missing".into()];
    assert!(
        repo::record_successful_feed_refresh(&pool, 1, &hashes, &hashes, 200)
            .await
            .is_err()
    );
    let counts: (i64,i64,i64) = sqlx::query_as("SELECT (SELECT COUNT(*) FROM article_identity),(SELECT last_seen_at FROM article_identity WHERE guid_hash='seen'),(SELECT last_successful_refresh_at FROM feed)").fetch_one(&pool).await.unwrap();
    assert_eq!(counts, (1, 1, 1));
}

#[tokio::test]
async fn tc_db_015_identity_cleanup_batches_are_bounded() {
    let pool = db::create_memory_pool().await.unwrap();
    seed_feed(&pool, false).await;
    for i in 0..maintenance::CLEANUP_BATCH_SIZE + 1 {
        sqlx::query("INSERT INTO article_identity(guid_hash,feed_id,last_seen_at) VALUES(?,1,1)")
            .bind(format!("obsolete-{i}"))
            .execute(&pool)
            .await
            .unwrap();
    }
    sqlx::query("UPDATE feed SET last_successful_refresh_at=100000000")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        maintenance::cleanup_identities(&pool).await.unwrap(),
        maintenance::CLEANUP_BATCH_SIZE as u64
    );
    assert_eq!(maintenance::cleanup_identities(&pool).await.unwrap(), 1);
}
