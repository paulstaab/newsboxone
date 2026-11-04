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

- Language: Rust 2024 edition on Rust 1.95.0
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

- Language: TypeScript 7.0
- Runtime: Node.js 26+
- Framework: Next.js 16 App Router
- UI library: React 19
- Data fetching: SWR 2.x
- Styling: Tailwind CSS 4.1
- Date utilities: `date-fns` 4.x
- Linting: Oxlint with `oxlint-tsgolint` for type-aware checks; `options.typeAware` is set in the repository-root `.oxlintrc.json` so workspace-root and frontend lint runs share it; formatting remains Oxfmt
- TypeScript path aliases: relative `paths` entries without the removed `baseUrl` option
- Lint rules: migrated ESLint core, strict/stylistic TypeScript, React/hooks, Next.js, and accessibility rules in `frontend/.oxlintrc.json`; test-specific exceptions remain scoped to tests
- Migration coverage: Next.js `no-location-assign-relative-destination` has no Oxlint equivalent. React JSX usage rules and strict-mode checks are redundant; React Compiler `config`/`gating` checks have no configurable Oxlint counterpart.
- Test and mock tooling: Playwright, Vitest, Testing Library, MSW
- Playwright frontend server mode: `next dev --webpack` for stable browser test runs under Next.js 16
- Frontend dependency resolution: npm lockfile with an override that keeps transitive `postcss` consumers on the patched 8.5.x line

### Frontend Implementation Guidance

- Wrap page content in a shared authentication context and SWR data layer. The product behavior is tracked by `APP-003` in `docs/frontend-requirements.md`; SWR is an architecture choice rather than a product acceptance criterion.
- Scope SWR caches to the active browser session. Logout and expiry clear timeline storage and pending reads while retaining browser-local integration credentials.
- Browser storage helpers fall back to in-memory values when storage access or quota fails and notify the shell to show a persistence warning.
- Persist optimistic read IDs and article snapshots with the versioned timeline envelope. Retry connectivity failures on reconnect; roll back definitive server rejections. Apply retention caps when persisting offline data, not when merging online articles.
- Restore Karakeep saved state with its browser-only `GET /api/v1/bookmarks/check-url` endpoint before allowing save/delete actions; failed checks remain unknown until Retry. See the [Karakeep API contract](https://docs.karakeep.app/api/check-bookmark-url/).
- Timeline effects shall declare their React hook dependencies directly and use stable refs or callbacks for intentionally one-shot behavior. This contributor rule was moved from the retired `TIMELINE-040` requirement.
- Sanitize fetched and fallback article HTML at the frontend API boundary before rendering. The resulting content safety behavior is tracked by `TIMELINE-012a`.
- Use a scroll sentinel to determine when the folder queue docks and its measured dock height to offset timeline content, supporting `TIMELINE-016` and `TIMELINE-017`.
- Product requirements describe the agreed target behavior; this stack overview describes architecture and implementation guidance and does not certify that every target requirement is already implemented.

## API And Auth

- Public API namespace: `/api`
- Health endpoint: `/api/status`
- Frontend API access: composed TypeScript API client using same-origin requests to `/api/*`
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
- Dependency update automation: Dependabot for devcontainers, Docker images, GitHub Actions, Cargo, and npm
- Container packaging: root `Dockerfile` plus `docker/nginx.conf`
- Container backend build: Rust 1.95.0 Debian Bookworm image

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
