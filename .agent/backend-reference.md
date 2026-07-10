# Backend Reference (Optional Detail)

Use this file for backend reference details.
Mandatory backend policy is in `/backend/AGENTS.md`.

## Key API Endpoints

- `/api/status` for health checks
- `/api/feeds` for feed operations
- `/api/folders` for folder operations
- `/api/items` for item operations

## CLI and Local Smoke Commands

- `cargo run -- --help`
- `cargo run -- update`
- `cargo run -- serve --host 127.0.0.1 --port 8000`
- `curl http://localhost:8000/api/status`
- `curl http://localhost:8000/api/version`

## Repository Map

- Entrypoint: `src/main.rs`
- API composition: `src/api.rs`
- Feed and article behavior: `src/article_store.rs`, `src/updater.rs`, `src/repo.rs`
- Content enrichment and extraction: `src/content.rs`, `src/llm.rs`
- Email ingestion: `src/email.rs`, `src/email_credentials.rs`
- Integration tests: `tests/`

## Troubleshooting

If tests fail due to stale database state, remove the effective SQLite file at:
- `DATABASE_PATH` when set, or
- default path such as `data/headless-rss.sqlite3*`

Then rerun the relevant command.
