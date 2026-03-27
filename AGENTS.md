# NewsBoxOne Agent Instructions

## Purpose

This file defines repository-level instructions for agent and contributor work in NewsBoxOne.
Use it for tasks that touch shared infrastructure, combined product behavior, or both subprojects together.

For implementation details inside a single domain, also follow the domain-specific file:

- `backend/AGENTS.md`
- `frontend/AGENTS.md`

## Project Summary

NewsBoxOne is a unified repository that packages:

- a Rust backend in `backend/`
- a static-export Next.js frontend in `frontend/`
- a single deployable container defined at the repository root

The combined public runtime surface is:

- `/` for the frontend
- `/api` for the public NewsBoxOne API
- `/status` for health

## Scope Rules

- Use this file as the top-level source of truth for shared repository behavior.
- If a task is backend-only, follow this file plus `backend/AGENTS.md`.
- If a task is frontend-only, follow this file plus `frontend/AGENTS.md`.
- If a task spans frontend and backend, follow this file first, then the relevant domain files.

## Repository Priorities

- Preserve the single-container delivery model.
- Keep the combined public API surface limited to `/api`.
- Keep shared tooling consolidated at the repository root.
- Avoid duplicating infrastructure between root, frontend, and backend.
- Prefer small, reviewable changes that preserve existing behavior unless the task explicitly changes behavior.

## Source Of Truth

When understanding or changing behavior, use these sources in this order:

1. implemented code and root infrastructure files
2. automated tests and CI workflows
3. maintained documentation in `docs/`
4. domain-specific docs under `backend/docs/` and `frontend/docs/`

## Shared Infrastructure Ownership

The following are root-owned and should stay consolidated:

- `.devcontainer/devcontainer.json`
- `.vscode/tasks.json`
- `.vscode/settings.json`
- `.github/workflows/ci.yml`
- `.github/workflows/dependabot-auto-merge.yml`
- `Dockerfile`
- `docker/nginx.conf`
- `docker/entrypoint.sh`
- `docs/requirements.md`

Do not recreate per-project copies of shared devcontainer, CI, or root Docker packaging unless the task explicitly requires it.

## Public Runtime Rules

- The combined container must serve the frontend at `/`.
- The combined container must expose the backend health endpoint at `/status`.
- The combined container must expose the NewsBoxOne API at `/api`.
- Do not expose legacy or internal backend mount paths publicly through nginx unless the task explicitly changes the combined product contract.
- If backend compatibility routes remain implemented internally, treat them as backend concerns, not combined public surface.

## Documentation Sync Policy

When repository-level behavior changes, update the relevant top-level docs in the same task:

- `docs/requirements.md` for shared product requirements
- `docs/api-contract.yaml` for the shared public API contract
- `docs/frontend-requirements.md` for frontend behavior changes
- `docs/backend-requirements.md` for backend behavior changes
- `docs/frontend-test-cases.md` for frontend test coverage changes
- `docs/backend-test-cases.md` for backend test coverage changes

If the task changes combined packaging, CI, routes, or developer workflow and the docs are not updated, treat the work as incomplete.

## Validation Expectations

Use the narrowest relevant validation for the task.

Shared repo validation:

- `Workspace: Validate`

Backend validation:

- `cargo fmt --all -- --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --all-targets --all-features`

Frontend validation:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e` when behavior changes warrant it

Combined packaging validation when relevant:

- `docker build -t newsboxone:local .`
- verify `/`, `/api/version`, and `/status` against a local container run

If you do not run a relevant validation step, say so clearly.

## Useful Paths

- Root README: `README.md`
- Combined requirements: `docs/requirements.md`
- Backend instructions: `backend/AGENTS.md`
- Frontend instructions: `frontend/AGENTS.md`
- Combined container build: `Dockerfile`
- Public proxy config: `docker/nginx.conf`
- Shared tasks: `.vscode/tasks.json`

## Notes For Agents

- Keep root-level docs and root-level infrastructure aligned.
- Do not treat old standalone-project assumptions as canonical without checking the root files first.
- When in doubt about behavior ownership, decide whether the change is frontend-only, backend-only, or combined-product behavior, then update the matching docs and validations.