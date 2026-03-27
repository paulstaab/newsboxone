# NewsBoxOne

NewsBoxOne combines the `headless-rss` Rust backend and the NewsBoxZero Next.js frontend into a single repository and a single deployable container.

The combined product serves:

- the frontend at `/`
- the public NewsBoxOne API at `/api`
- the backend health endpoint at `/api/status`

The public container intentionally exposes only the unified surface above. The backend may still retain additional internal compatibility routes, but they are not part of the combined public proxy surface.

## Repository Layout

```text
.
├── backend/      # Rust service, database migrations, API contracts, backend tests
├── frontend/     # Next.js static frontend, UI tests, frontend-specific docs
├── docs/         # Shared product requirements and top-level test catalogs
├── docker/       # Combined container runtime scripts and nginx config
├── .devcontainer/# Shared development container config
├── .github/      # Unified CI and automation workflows
└── .vscode/      # Shared workspace tasks and settings
```

## Architecture

- `backend/` builds the `headless-rss` binary.
- `frontend/` builds a static export consumed by nginx.
- The root `Dockerfile` builds both parts and packages them into one runtime image.
- nginx serves the frontend and reverse proxies `/api` to the backend API implementation.

## Local Development

### Prerequisites

- Rust 1.88
- Node.js 24+
- npm
- Docker, if you want to validate the combined container locally

### Workspace Tasks

The repository provides shared VS Code tasks at the root for the common workflows:

- `Backend: Lint`
- `Backend: Test`
- `Backend: Serve`
- `Frontend: Install Dependencies`
- `Frontend: Lint`
- `Frontend: Test`
- `Frontend: E2E`
- `Frontend: Dev`
- `Workspace: Dev`
- `Workspace: Validate`

### Manual Commands

Backend:

```bash
cd backend
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo run -- serve --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Combined Container

Build from the repository root:

```bash
docker build -t newsboxone:local .
```

Run the combined image:

```bash
docker run --rm -p 8000:8000 \
  -v newsboxone-data:/app/data \
  -e USERNAME=myuser \
  -e PASSWORD=mypassword \
  newsboxone:local
```

Then verify:

- `http://localhost:8000/`
- `http://localhost:8000/api/version`
- `http://localhost:8000/api/status`

## Documentation

Top-level product and test documentation lives in `docs/`:

- `docs/requirements.md`
- `docs/api-contract.yaml`
- `docs/frontend-requirements.md`
- `docs/backend-requirements.md`
- `docs/frontend-test-cases.md`
- `docs/backend-test-cases.md`

## CI

The root CI workflow validates both subprojects and then builds the combined container image.

On `main`, the container job publishes:

- `ghcr.io/<owner>/<repo>:latest`

In this repository, that resolves to `ghcr.io/paulstaab/newsboxone:latest`.

## Contributing

- Treat `backend/` and `frontend/` as implementation domains with their own detailed instructions.
- Treat the repository root as the source of truth for shared infrastructure, CI, devcontainer, Docker packaging, and combined requirements.
- Keep top-level docs synchronized when behavior or workflow changes cross project boundaries.

## License

This repository is licensed under the MIT License. See `LICENSE`.
