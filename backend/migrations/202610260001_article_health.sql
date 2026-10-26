-- Preserve the earliest identity and user flags when reconciling legacy duplicates.
CREATE INDEX idx_article_guid_hash_migration ON article(guid_hash);
UPDATE article
SET starred = (SELECT MAX(a.starred) FROM article a WHERE a.guid_hash = article.guid_hash),
    unread = (SELECT MAX(a.unread) FROM article a WHERE a.guid_hash = article.guid_hash),
    last_modified = (SELECT MAX(a.last_modified) FROM article a WHERE a.guid_hash = article.guid_hash)
WHERE id IN (SELECT MIN(id) FROM article GROUP BY guid_hash HAVING COUNT(*) > 1);
DELETE FROM article WHERE id NOT IN (SELECT MIN(id) FROM article GROUP BY guid_hash);
DROP INDEX idx_article_guid_hash_migration;

-- Track successful feed observations independently of retained article payloads.
ALTER TABLE feed ADD COLUMN last_successful_refresh_at INTEGER;
CREATE TABLE article_identity (
    guid_hash TEXT PRIMARY KEY NOT NULL,
    feed_id INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
    last_seen_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
) WITHOUT ROWID;
CREATE INDEX idx_article_identity_feed_seen ON article_identity(feed_id, last_seen_at);
INSERT INTO article_identity(guid_hash, feed_id) SELECT guid_hash, feed_id FROM article;

-- Expiry may remove the highest article id: never reuse ids referenced by client cursors.
CREATE TABLE article_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title VARCHAR,
    content VARCHAR,
    author VARCHAR,
    summary VARCHAR,
    content_hash VARCHAR,
    enclosure_link VARCHAR,
    enclosure_mime VARCHAR,
    feed_id INTEGER NOT NULL,
    fingerprint VARCHAR,
    guid VARCHAR NOT NULL,
    guid_hash VARCHAR NOT NULL,
    last_modified INTEGER NOT NULL,
    media_description VARCHAR,
    media_thumbnail VARCHAR,
    pub_date INTEGER,
    rtl BOOLEAN NOT NULL DEFAULT 0,
    starred BOOLEAN NOT NULL DEFAULT 0,
    unread BOOLEAN NOT NULL DEFAULT 1,
    updated_date INTEGER,
    url VARCHAR,
    FOREIGN KEY(feed_id) REFERENCES feed(id)
);

INSERT INTO article_new (
    id,
    title,
    content,
    author,
    summary,
    content_hash,
    enclosure_link,
    enclosure_mime,
    feed_id,
    fingerprint,
    guid,
    guid_hash,
    last_modified,
    media_description,
    media_thumbnail,
    pub_date,
    rtl,
    starred,
    unread,
    updated_date,
    url
)
SELECT
    id,
    title,
    content,
    author,
    summary,
    content_hash,
    enclosure_link,
    enclosure_mime,
    feed_id,
    fingerprint,
    guid,
    guid_hash,
    last_modified,
    media_description,
    media_thumbnail,
    pub_date,
    rtl,
    starred,
    unread,
    updated_date,
    url
FROM article;

DROP TABLE article;
ALTER TABLE article_new RENAME TO article;

CREATE INDEX idx_feed_folder_id ON feed(folder_id);
CREATE UNIQUE INDEX idx_article_guid_hash ON article(guid_hash);
CREATE INDEX idx_article_feed_id_id ON article(feed_id, id);
CREATE INDEX idx_article_feed_pub_date ON article(feed_id, pub_date);
CREATE INDEX idx_article_retention ON article(last_modified, id) WHERE unread = 0 AND starred = 0;
CREATE INDEX idx_article_unread_retention ON article(last_modified, id) WHERE unread = 1 AND starred = 0;

-- Both triggers run in the article insert's transaction, including direct SQL imports.
CREATE TRIGGER article_skip_seen_identity BEFORE INSERT ON article
WHEN EXISTS (SELECT 1 FROM article_identity WHERE guid_hash = NEW.guid_hash)
BEGIN
    SELECT RAISE(IGNORE);
END;
CREATE TRIGGER article_record_identity AFTER INSERT ON article
BEGIN
    INSERT INTO article_identity(guid_hash, feed_id) VALUES(NEW.guid_hash, NEW.feed_id);
END;
