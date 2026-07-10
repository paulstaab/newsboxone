# Shared Mandatory Policy

This file contains the shared must-follow policy for agent and contributor work in NewsBoxOne.
`/AGENTS.md` should stay short and route here.

## Answer Style

- Use short, concise, technical answers.
- Prefer direct statements over narrative.
- Include only implementation-relevant detail.

## Project Summary

NewsBoxOne is a unified repository that packages:

- a Rust backend in `backend/`
- a static-export Next.js frontend in `frontend/`
- a single deployable container defined at the repository root

The combined public runtime surface is:

- `/` for the frontend
- `/api` for the public NewsBoxOne API
- `/api/status` for health

## Scope Rules

- Use this policy as the top-level source of truth for shared repository behavior.
- If a task is backend-only, follow this policy plus `backend/AGENTS.md`.
- If a task is frontend-only, follow this policy plus `frontend/AGENTS.md`.
- If a task spans frontend and backend, follow this policy first, then the relevant domain files.

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

## Public Runtime Rules

- The combined container must serve the frontend at `/`.
- The combined container must expose the backend health endpoint at `/api/status`.
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
- `docs/e2e-test-cases.md` for cross-stack end-to-end scenario coverage changes

If the task changes combined packaging, CI, routes, or developer workflow and the docs are not updated, treat the work as incomplete.

## Improvement Ideas Log

Keep `docs/improvement-ideas.md` as the maintained repository-level backlog for significant improvement and refactoring ideas encountered during coding sessions.

Rules:

- Keep entries concise and actionable.
- Add only significant ideas that plausibly warrant planning or review.
- Do not use this backlog as a substitute for required documentation updates in the current task.

See `.agent/shared-reference.md` for extended guidance.

## Test Taxonomy

NewsBoxOne should maintain these automated test categories:

- backend unit tests
- backend integration tests
- frontend unit tests
- frontend integration tests
- e2e scenario tests

Rules:

- Create unit tests whenever they are practical and provide meaningful local coverage.
- Unit tests are not tracked in the top-level `docs/` catalogs.
- `docs/backend-test-cases.md` is the maintained catalog for backend integration tests.
- `docs/frontend-test-cases.md` is the maintained catalog for frontend integration tests.
- `docs/e2e-test-cases.md` is the maintained catalog for end-to-end scenario tests.
- Backend integration tests should be derived from `docs/backend-test-cases.md`.
- Frontend integration tests should be derived from `docs/frontend-test-cases.md`.
- End-to-end scenario tests should be derived from `docs/e2e-test-cases.md`.
- Frontend unit tests and frontend integration tests must run standalone and mock the backend API instead of depending on a live backend.
- Prefer live-backend e2e scenario tests over frontend integration tests whenever a user-visible flow can reasonably be validated through the combined product.
- Use frontend integration tests mainly for focused frontend behavior that needs only minimal mocked API interaction, such as browser-platform or PWA installation flows.

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
- `npm run test` for frontend unit tests
- `npm run test:integration` for standalone mocked frontend integration tests
- `npm run test:e2e` for live-backend end-to-end scenarios when behavior changes warrant it

Combined packaging validation when relevant:

- `docker build -t newsboxone:local .`
- verify `/`, `/api/version`, and `/api/status` against a local container run

If you do not run a relevant validation step, say so clearly.

## Useful Paths

- Root README: `README.md`
- Combined requirements: `docs/requirements.md`
- Improvement ideas log: `docs/improvement-ideas.md`
- Backend instructions: `backend/AGENTS.md`
- Frontend instructions: `frontend/AGENTS.md`
- Shared reference details: `.agent/shared-reference.md`

## Notes For Agents

- Keep root-level docs and root-level infrastructure aligned.
- Do not treat old standalone-project assumptions as canonical without checking the root files first.
- When in doubt about behavior ownership, decide whether the change is frontend-only, backend-only, or combined-product behavior, then update the matching docs and validations.
