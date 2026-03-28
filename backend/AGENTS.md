# AGENTS.md

## Purpose
This file defines how coding agents and contributors should work in this repository.
It combines workflow guidance with implementation-aware project conventions.

## Project Summary
- `headless-rss` is a self-hosted RSS/Atom aggregator.
- It powers the NewsBoxOne API documented in `../docs/api-contract.yaml`.
- It includes email newsletter ingestion over IMAP.
- It supports optional AI-assisted summarization and newsletter parsing via OpenAI.
- The production implementation is Rust-only.

## Repository Priorities
- Keep the project minimal and stable.
- Keep the public API contract coherent and documented.
- Favor safe defaults and clear error handling.
- Do not introduce unnecessary complexity.

## Key Runtime Behavior
- The service exposes a health endpoint at `/api/status`.
- The canonical public API contract is `../docs/api-contract.yaml` and is exposed from the combined product at `/api`.
- The public backend API is mounted under `/api`.
- Feed updates run on startup and then on a periodic schedule controlled by `FEED_UPDATE_FREQUENCY_MIN` (default `15`).
- Root folder behavior:
  - Root folder is internal.
  - Root folder is omitted from folder listings.
  - `folderId: null` and `folderId: 0` map to root when creating/moving feeds.

## Authentication and Security
- Basic auth is enabled only when both `USERNAME` and `PASSWORD` are set.
- When auth is enabled:
  - Missing credentials must return `401` with `{"detail":"Not authenticated"}`.
  - Invalid credentials must return `401` with `{"detail":"Invalid authentication credentials"}`.
- URL validation is required for remote fetches and must protect against SSRF:
  - Allow only `http` and `https`.
  - Block loopback, private, link-local, unspecified, multicast, and metadata service addresses.

## API Contract Rules
- Treat `../docs/api-contract.yaml` as the public API source of truth.
- Backward compatibility with Nextcloud News v1.2 or v1.3 is not required unless a task explicitly asks for it.
- Keep request and response payloads aligned with the documented NewsBoxOne API contract.

## Data and Domain Rules
- Keep uniqueness constraints intact:
  - Feed URL unique.
  - Folder name unique.
- Deleting a feed must delete associated articles.
- Deleting a folder must delete feeds in that folder.
- Avoid creating duplicate articles (guid-hash based de-duplication).
- Preserve stale-content cleanup behavior:
  - Old read and unstarred feed/newsletter entries are eligible for cleanup.

## CLI Rules
- Keep CLI commands functional:
  - `cargo run -- update`
  - `cargo run -- add-email-credentials --server ... --port ... --username ... --password ...`
- `cargo run -- --help` should remain usable.
- `add-email-credentials` must validate mailbox connectivity before persisting credentials.

## Required Workflow
1. Bootstrap
- Ensure the Rust toolchain is available.
- Run `cargo fetch` if dependencies have not been downloaded yet.

2. Develop
- Always keep requirements and test cases updated - see Documentation Sync Policy.
- Create backend unit tests whenever practical for local behavior coverage, even though unit-test inventories are not tracked in `../docs/`.
- Prefer small, focused changes.
- Preserve documented API behavior and response contracts unless the task explicitly changes them.
- When manual runtime validation is needed, start the API server from the CLI and keep it running in the background while testing.
  - Preferred command: `cargo run -- serve --host 127.0.0.1 --port 8000`
  - If the default bind address is acceptable, `cargo run` is also valid.
- The local server should listen on `http://localhost:8000`.
- When finished, update the rustdoc comments for touched modules and functions if necessary. Also document reasons for implementation decisions there.

3. Validate after changes
- Run formatting checks from the CLI:
  - `cargo fmt --all -- --check`
- Run lint from the CLI:
  - `cargo clippy --all-targets --all-features -- -D warnings`
- Run the full test suite from the CLI:
  - `cargo test --all-targets --all-features`
- Validate CLI:
  - `cargo run -- --help`
  - `cargo run -- update`

4. Optional end-to-end smoke test
- Start server:
  - `cargo run -- serve --host 127.0.0.1 --port 8000`
- Verify:
  - `curl http://localhost:8000/api/status`
  - `docker build -t newsboxone:local ..`
  - `docker run --rm -p 8000:8000 newsboxone:local`
  - `curl http://localhost:8000/api/feeds`
  - `curl http://localhost:8000/api/folders`
  - `curl http://localhost:8000/api/version`

## Repository Structure
```
.
├── .devcontainer/          # VS Code dev container configuration
├── .github/                # GitHub workflows and config
├── .pre-commit-config.yaml # Pre-commit hooks (Rust formatting/linting)
├── Dockerfile              # Container build definition
├── README.md               # Project overview and local usage
├── Cargo.toml              # Rust project manifest
├── Cargo.lock              # Locked Rust dependencies
├── data/                   # SQLite database location
├── docker/                 # Docker-related scripts
├── docs/                   # Requirements, contracts, and test catalogs
├── migrations/             # SQLx migrations
├── src/                    # Main Rust application code
├── tests/                  # Rust test suite
└── vendor/                 # Vendored crates and assets
```

## Key API Endpoints
- `/api/status` for health checks.
- `/api/feeds` for public feed operations in the combined product.
- `/api/folders` for public folder operations in the combined product.
- `/api/items` for public item operations in the combined product.

## Environment and Storage
- `USERNAME` and `PASSWORD` are optional and enable HTTP Basic auth only when both are set.
- By default, SQLite data lives at `data/headless-rss.sqlite3` (or `../data/headless-rss.sqlite3` depending on the working directory). This can be overridden via the `DATABASE_PATH` environment variable.
- SQLx migrations are applied automatically on startup.

## Troubleshooting
- If tests fail due to database state, remove the SQLite database at the effective path (the value of `DATABASE_PATH` if set, otherwise the default such as `data/headless-rss.sqlite3*`) and rerun the relevant command or restart the server.

## Documentation Sync Policy
When implementing fixes, refactors, or new features, keep documentation synchronized in the same change:
- Update `../docs/backend-requirements.md` to reflect implemented requirements.
- Update `../docs/backend-test-cases.md` to reflect backend integration coverage changes.
- Update `../docs/e2e-test-cases.md` when backend changes affect shared live-backend end-to-end journeys.
- Update `../docs/api-contract.yaml` when public API behavior changes.
- If code behavior changes but docs are not updated, treat the task as incomplete.
- Always add or update rustdoc comments when adding or changing a function or a module.

## Test Taxonomy

Backend work should follow the repository test taxonomy:

- backend unit tests
- backend integration tests
- e2e scenario tests when backend changes affect the combined product journey

Rules:

- Add backend unit tests whenever practical to cover isolated logic and small behavior decisions.
- Backend unit tests are not tracked in the top-level `../docs/` catalogs.
- `../docs/backend-test-cases.md` is the maintained catalog for backend integration tests.
- Backend integration tests should be derived from `../docs/backend-test-cases.md`.
- Backend integration tests should exercise multiple backend components together, such as API routes, persistence, migrations, refresh flows, and CLI-driven workflows.
- Backend integration test names should include one or more matching `TC-*` identifiers from `../docs/backend-test-cases.md`.
- Cross-stack browser-visible journeys belong in `../docs/e2e-test-cases.md`, not in `../docs/backend-test-cases.md`.

## Useful Paths
- App entrypoint: `src/main.rs`
- API router composition:
  - `src/api.rs`
- Core domain modules:
  - `src/article_store.rs`
  - `src/content.rs`
  - `src/email.rs`
  - `src/email_credentials.rs`
  - `src/repo.rs`
  - `src/updater.rs`
- CLI: `src/main.rs`
- Tests: `tests/`

## Notes for Agents
- Prefer behavior-preserving edits unless the task explicitly requests behavior changes.
- Add or update tests when behavior changes.
- Keep changes readable and easy to review.
