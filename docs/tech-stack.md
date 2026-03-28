# Tech Stack

## Purpose

This document is the canonical high-level stack overview for the combined NewsBoxOne product.
It describes the shared runtime, major technologies, development workflow, and packaging model across the repository.

## Product Shape

- Monorepo with a Rust backend in `backend/`
- Static-export-oriented Next.js frontend in `frontend/`
- Single deployable container built from the repository root
- Public runtime surface exposed at `/`, `/api`, and `/api/status`

## Backend Stack

- Language: Rust 2024 edition
- Web framework: `axum`
- Async runtime: `tokio`
- HTTP client: `reqwest`
- Serialization: `serde`, `serde_json`
- Persistence: SQLite via `sqlx`
- Feed parsing and extraction: `feed-rs`, `readability-js`
- Email ingestion: `imap`, `native-tls`
- CLI: `clap`
- Logging: `tracing`, `tracing-subscriber`

## Frontend Stack

- Language: TypeScript 5.9
- Runtime: Node.js 24+
- Framework: Next.js 16 App Router
- UI library: React 19
- Data fetching: SWR 2.x
- Styling: Tailwind CSS 4.1
- Date utilities: `date-fns` 4.1
- Test and mock tooling: Playwright, Vitest, Testing Library, MSW

## API And Auth

- Public API namespace: `/api`
- Health endpoint: `/api/status`
- Frontend API access: same-origin requests to `/api/*`
- Authentication: backend-issued opaque bearer tokens, with token issuance validated against configured backend `USERNAME` and `PASSWORD`
- Local frontend dev proxy: Next.js rewrites `/api/*` to `NEWSBOXONE_BACKEND_ORIGIN`, defaulting to `http://127.0.0.1:8000`

## Storage

- Backend data store: SQLite database under `data/` by default
- Frontend session storage: token-backed session data in `sessionStorage` by default, `localStorage` when remember-device is enabled
- Frontend storage namespace: `newsboxone:*`

## Shared Tooling

- Workspace tasks: root `.vscode/tasks.json`
- Dev container: root `.devcontainer/devcontainer.json`
- CI: GitHub Actions under `.github/workflows/`
- Container packaging: root `Dockerfile` plus `docker/nginx.conf`

## Local Development

- Preferred combined task: `Workspace: Serve`
- Backend local port: `8000`
- Frontend local port: `3000`
- VS Code behavior: backend and frontend tasks open in split terminals
- Default local credentials from the VS Code backend task: `test` / `test`

## Validation

- Shared workflow: `Workspace: Validate`
- Backend: `cargo fmt --all -- --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test --all-targets --all-features`
- Frontend: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run test:e2e` when needed

## Related Documents

- Combined requirements: `docs/requirements.md`
- Public API contract: `docs/api-contract.yaml`
- Backend requirements: `docs/backend-requirements.md`
- Frontend requirements: `docs/frontend-requirements.md`
- Backend implementation notes: `backend/docs/techstack.md`
- Frontend implementation notes: `frontend/docs/tech-stack.md`
