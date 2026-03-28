# Requirements Baseline

## Purpose
This document defines the combined product requirements for NewsBoxOne.
It covers the repository-level infrastructure needed to ship the frontend and backend as one product while keeping implementation details in the frontend and backend requirement baselines.

## Related Contracts And Tests
- Product-specific requirement baselines:
  - `docs/frontend-requirements.md`
  - `docs/backend-requirements.md`
- Product-specific integration-test catalogs:
  - `docs/frontend-test-cases.md`
  - `docs/backend-test-cases.md`
- Shared end-to-end scenario catalog:
  - `docs/e2e-test-cases.md`
- Shared API contract:
  - `docs/api-contract.yaml`

## Requirement IDs
- IDs are stable and unique.
- Prefixes indicate the combined-project domain:
  - `DEL-*`: delivery and deployment
  - `API-*`: externally exposed API surface
  - `DEV-*`: developer workflow and local tooling
  - `CI-*`: continuous integration and release automation
  - `DOC-*`: maintained documentation structure

## Requirements

### Delivery
- `DEL-001`: The combined product shall be deliverable as a single self-hosted container image.
- `DEL-002`: The combined container shall serve the frontend application at `/`.
- `DEL-003`: The combined container shall expose the backend health endpoint at `/api/status`.
- `DEL-004`: The combined container shall include both the Rust backend runtime and the built static frontend assets without requiring a second service container.

### API Surface
- `API-001`: The combined container shall expose the NewsBoxOne API at `/api`.
- `API-002`: The public API contract shall be defined by `docs/api-contract.yaml`.
- `API-003`: Backward compatibility with the Nextcloud News v1.2 or v1.3 specifications is not required.
- `API-004`: The combined frontend shall call the NewsBoxOne API through same-origin requests and shall not require user-entered server base URLs.

### Developer Workflow
- `DEV-001`: The repository shall provide a single root devcontainer configuration for working on frontend and backend together.
- `DEV-002`: The repository shall provide a single root VS Code tasks file covering frontend and backend lint, test, build, and serve workflows.
- `DEV-003`: The repository shall keep per-project source code and language-specific manifests under `frontend/` and `backend/` while moving shared infrastructure to the repository root.
- `DEV-004`: The repository shall maintain backend unit tests, backend integration tests, frontend unit tests, frontend integration tests, and end-to-end scenario tests as the shared automated testing taxonomy.
- `DEV-005`: Unit tests shall be added whenever they are practical and useful, but unit-test inventories shall not be tracked in the top-level `docs/` catalogs.
- `DEV-006`: Frontend unit tests and frontend integration tests shall run standalone and mock the backend API rather than depending on a live backend service.
- `DEV-007`: Live-backend end-to-end scenario tests shall be preferred over frontend integration tests for cross-stack user journeys, while frontend integration tests shall remain available for focused frontend behavior that needs only minimal mocked API interaction.

### Continuous Integration
- `CI-001`: The repository shall provide a single root CI workflow that validates backend and frontend changes in one pipeline.
- `CI-002`: The root CI workflow shall build the combined container image from the repository root.
- `CI-003`: The root release automation shall publish only the combined container image for the unified project.

### Documentation
- `DOC-001`: Shared product requirements shall be maintained in this top-level document.
- `DOC-002`: Frontend and backend requirement baselines shall be maintained in the top-level `docs/` directory using `frontend-` and `backend-` prefixes.
- `DOC-003`: Frontend and backend integration-test catalogs shall be maintained in the top-level `docs/` directory using `frontend-` and `backend-` prefixes.
- `DOC-004`: Cross-stack end-to-end scenario coverage shall be maintained in `docs/e2e-test-cases.md`.
- `DOC-005`: The shared public API specification shall be maintained as OpenAPI in `docs/api-contract.yaml`.
