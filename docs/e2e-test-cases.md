# E2E Scenario Test Baseline

## Purpose

This document is the canonical end-to-end scenario baseline for cross-stack NewsBoxOne journeys.
It should contain only scenarios that exercise the frontend and backend together through the combined product surface.

This document is the maintained baseline for e2e scenario tests.
These scenarios are preferred over frontend integration tests whenever the behavior can reasonably be validated through the live combined product.

## Execution Model

- Prefer running scenarios against the real frontend and the real backend together.
- Prefer same-origin browser traffic through the frontend at `/` and the backend at `/api`.
- Prefer validating real user journeys here instead of reproducing them as frontend-only mocked integration tests.
- Keep mocking minimal:
  - allowed: external RSS or Atom origins, IMAP mailbox inputs, OpenAI-compatible provider responses, and browser-only platform events such as install-prompt simulation
  - avoid: mocking NewsBoxOne API routes in Playwright when the scenario can run against the live backend
- Each scenario should start from a known-empty backend database unless the scenario explicitly depends on persisted browser state.
- UI scenarios should authenticate through the real login form with configured backend credentials instead of prewriting browser storage where practical.
- Frontend-only standalone integration checks that mock the backend belong in `docs/frontend-test-cases.md`.
- Backend-only API, CLI, and pipeline checks belong in `docs/backend-test-cases.md`.
- Use frontend integration tests only when minimal mocked API interaction is sufficient and a live-backend scenario would add little value, for example PWA installation behavior.

## Shared Preconditions

- Frontend is running on `http://127.0.0.1:3000`.
- Backend is running on `http://127.0.0.1:8000`.
- During frontend development and Playwright runs, `/api/*` requests are forwarded to the backend origin.
- For local development, the default backend credentials are `test` / `test`.
- Fixture feed sources should be deterministic and locally controlled when unread-count or update-order assertions matter.

## Scenario Groups

### Service Startup and Authentication

| ID | Description | Precondition | Actions | Expected Result |
|---|---|---|---|---|
| `TS-SERVICE-001` | Combined service starts and exposes the public surface | Frontend and backend are both running with an empty database. | Open `/`, call `/api/status`, and call `/api/version`. | Frontend responds, health returns `200` with `{"status":"ok"}`, and version returns `200` with a valid version payload. |
| `TS-LOGIN-001` | Signed-out visitor is routed to login | Browser storage is empty. | Open `/` and then `/timeline`. | The app redirects to `/login` and shows the username and password form. |
| `TS-LOGIN-002` | Valid credentials create a working browser session | Backend auth is enabled with known credentials. | Sign in through `/login` and then open `/timeline`. | The app stores a session under `newsboxone:session` and reaches the timeline. |
| `TS-LOGIN-003` | Invalid credentials are rejected safely | Backend auth is enabled with known credentials. | Submit the login form with an invalid password. | The app stays on `/login`, keeps the username, clears the password, and shows an inline auth error. |
| `TS-LOGIN-004` | Remember-device choice controls storage persistence | Backend auth is enabled with known credentials. | Complete login once with remember disabled and once with remember enabled. | The default session lands in `sessionStorage`; remembered login lands in `localStorage`. |
| `TS-LOGIN-005` | Signed-out visitor is routed to login from feed management | Browser storage is empty. | Open `/feeds`. | The app redirects to `/login` instead of exposing the authenticated feed-management page. |

### Feed Onboarding and Management

| ID | Description | Precondition | Actions | Expected Result |
|---|---|---|---|---|
| `TS-FEED-MGMT-001` | Reader adds feeds and receives initial items | Empty database; deterministic fixture feed origins are available. | Sign in, subscribe one or more feeds, trigger or wait for an update cycle, and open the timeline. | The feeds are persisted and unread timeline items become visible through the real backend. |
| `TS-FEED-MGMT-002` | Reader adds feeds into a folder | Empty database; fixture feed origins are available. | Create a folder, subscribe feeds into it, leave at least one feed uncategorized, and refresh feed management. | Folder assignments are persisted and reflected in feed and timeline views. |
| `TS-FEED-MGMT-003` | Duplicate feed add is prevented | A feed already exists. | Submit the same feed URL again through the feed-management UI. | The duplicate request fails without increasing feed count. |
| `TS-FEED-MGMT-004` | Reader reorganizes subscriptions | Existing folders and feeds are present. | Rename a folder, rename a feed, move a feed between folders, and move a feed back to uncategorized. | The updated names and assignments appear consistently across feed management and timeline grouping. |
| `TS-FEED-MGMT-005` | Reader deletes a feed and its items | Existing feed has unread items. | Delete the feed and then refresh feeds and items. | The feed disappears and its items are no longer returned. |
| `TS-FEED-MGMT-006` | Reader deletes a folder and cascades assigned feeds | Existing folder has assigned feeds. | Delete the folder and accept the warning. | The folder is removed, its feeds are unsubscribed, and unrelated root feeds remain. |

### Timeline and Reading Workflow

| ID | Description | Precondition | Actions | Expected Result |
|---|---|---|---|---|
| `TS-TIMELINE-001` | Highest-priority folder is shown first | Multiple folders contain unread items. | Open `/timeline`. | The active folder is the unread-priority leader and only its items are shown initially. |
| `TS-TIMELINE-002` | Reader marks a folder read and advances | Timeline contains unread items in at least two folders. | Click `Mark all read`. | The backend read API is called, the current folder leaves the queue, and the next folder becomes active. |
| `TS-TIMELINE-003` | Reader skips folders and restarts the queue | Timeline contains unread items in multiple folders. | Repeatedly skip folders until exhausted, then restart. | Skipped folders rotate to the end, `All folders viewed` appears, and restart restores the queue. |
| `TS-TIMELINE-004` | Reader opens an article without losing place | Timeline contains unread items. | Open an article card, inspect the pop-out, close it, and refresh. | Opening marks the item read optimistically, the pop-out renders content, and the item remains visible until reconciliation. |
| `TS-TIMELINE-005` | Keyboard shortcuts drive refresh, skip, and mark all read | Timeline is loaded and focus is outside form controls. | Press `r`, `ArrowRight`, and `Enter`. | Refresh, skip, and mark-all-read run through the real UI and update queue state correctly. |
| `TS-TIMELINE-006` | Queue progress survives reload | A folder was already processed in the current browser storage. | Reload `/timeline`. | The next folder remains active and processed content does not immediately reappear. |
| `TS-TIMELINE-007` | No unread items yields the caught-up state | Backend contains no unread items. | Open `/timeline`. | The page shows `All caught up!`. |
| `TS-TIMELINE-008` | Refresh failure preserves the current view | Timeline is populated and a later update cycle fails. | Load `/timeline`, trigger refresh, and induce an update failure from the backend or fixture origin. | Existing cards remain visible, refresh controls recover, and the UI surfaces an actionable error state. |

## Current Harness

- Shared live-backend scenarios live in the repository root under `tests/e2e/`.
- The frontend package runs them through `frontend/playwright.e2e.config.ts`.
- The harness starts a deterministic local fixture feed server, the real backend with a temporary test database, and the real frontend dev server.
- Browser authentication goes through the live login form with the configured backend credentials.
- Backend reset and feed seeding are handled through `tests/e2e/helpers/newsboxone.mjs` plus the backend CLI where needed.

## Scenarios Moved Out Of The Cross-Stack Baseline

- Frontend-only app-shell, accessibility, offline, and PWA checks should remain tracked in `docs/frontend-test-cases.md` rather than this document.
- Backend-only API contract, incremental sync, star or unstar API, updater, and newsletter-ingestion flows should remain tracked in `docs/backend-test-cases.md` unless they are rewritten as browser-visible cross-stack journeys.

## Recommended Next Step

Extend the shared live-backend harness with more browser-visible journeys before adding new frontend-only mocked integration cases.
