CREATE TABLE IF NOT EXISTS auth_token (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token VARCHAR NOT NULL UNIQUE,
    username VARCHAR NOT NULL,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_token_expires_at
    ON auth_token (expires_at);
