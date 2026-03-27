# Frontend Implemented Test Cases Baseline

## Purpose

This document catalogs the automated tests that currently exist for NewsBoxZero.
It is organized by shared shell behavior and page so coverage can scale as more pages are added.

## Source of Truth

- `tests/e2e/`
- `tests/unit/`
- `tests/visual/`

## Test Case IDs

- `TC-APP-*`: shared shell and cross-page behavior
- `TC-LOGIN-*`: login page
- `TC-FEEDS-*`: feed management page
- `TC-TIMELINE-*`: timeline page

## Shared App Shell

| ID           | Type   | Source                             | Case                                                             | Expected Result                                                                                                  |
| ------------ | ------ | ---------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `TC-APP-001` | E2E    | `tests/e2e/accessibility.spec.ts`  | Skip link is reachable from the keyboard.                        | Focus can move to the skip link and activation moves focus to `#main-content`.                                   |
| `TC-APP-002` | E2E    | `tests/e2e/accessibility.spec.ts`  | Login page has no axe violations.                                | Axe returns no WCAG 2.1 A/AA violations.                                                                         |
| `TC-APP-003` | E2E    | `tests/e2e/accessibility.spec.ts`  | Empty logged-in timeline has no axe violations.                  | Axe returns no WCAG 2.1 A/AA violations.                                                                         |
| `TC-APP-004` | E2E    | `tests/e2e/accessibility.spec.ts`  | Form controls and iconography meet baseline accessibility rules. | Label, contrast, and image-alt checks pass.                                                                      |
| `TC-APP-005` | E2E    | `tests/e2e/pwa-install.spec.ts`    | Install prompt can appear when install criteria are met.         | Install UI is visible when the browser exposes the install prompt.                                               |
| `TC-APP-006` | E2E    | `tests/e2e/pwa-install.spec.ts`    | Install prompt dismissal is persisted.                           | Dismissing the prompt hides it and stores `pwa-install-dismissed`.                                               |
| `TC-APP-007` | E2E    | `tests/e2e/pwa-install.spec.ts`    | Install prompt cooldown is enforced.                             | The prompt stays hidden within 7 days of dismissal and may reappear afterward.                                   |
| `TC-APP-008` | E2E    | `tests/e2e/pwa-install.spec.ts`    | Burger menu exposes manual install entry.                        | Opening the burger menu shows an install action, even if disabled.                                               |
| `TC-APP-009` | E2E    | `tests/e2e/pwa-install.spec.ts`    | Install state reacts to `appinstalled`.                          | Dispatching `appinstalled` hides the install prompt.                                                             |
| `TC-APP-010` | Visual | `tests/visual/pwa-install.spec.ts` | Install prompt layout at supported breakpoints and states.       | Prompt screenshots remain stable across mobile, tablet, desktop, hover, focus, dismissed, and timeline contexts. |

## Login Page

| ID             | Type | Source                                 | Case                                                 | Expected Result                                                                           |
| -------------- | ---- | -------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `TC-LOGIN-001` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | First visit redirects to login and shows the wizard. | `/` redirects to `/login` and the server URL step is visible.                             |
| `TC-LOGIN-002` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Valid server URL advances to credentials step.       | Successful `/version` validation reveals username and password fields.                    |
| `TC-LOGIN-003` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Unreachable server is rejected.                      | The user stays on the server step and sees a connectivity error.                          |
| `TC-LOGIN-004` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Wrong API path is rejected.                          | A 404-style validation failure shows an actionable server/API error.                      |
| `TC-LOGIN-005` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Non-HTTPS URLs are rejected.                         | The page shows the HTTPS validation error.                                                |
| `TC-LOGIN-006` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Credential inputs are required.                      | Username and password fields are present and marked `required`.                           |
| `TC-LOGIN-007` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Authentication progress is visible.                  | Submitting credentials shows the authenticating state and then redirects to `/timeline`.  |
| `TC-LOGIN-008` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Remember-device toggle is interactive.               | The checkbox is present, unchecked by default, and can be toggled.                        |
| `TC-LOGIN-009` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Default login persists session storage only.         | Successful login stores `newsboxzero:session` in `sessionStorage` and not `localStorage`. |
| `TC-LOGIN-010` | E2E  | `tests/e2e/us1-login-timeline.spec.ts` | Remembered login persists local storage.             | Successful login with remember enabled stores `newsboxzero:session` in `localStorage`.    |
| `TC-LOGIN-011` | Unit | `tests/unit/hooks/useAuth.test.ts`     | URL validation rejects insecure or empty input.      | `validateServerUrl` rejects `http` and empty values.                                      |
| `TC-LOGIN-012` | Unit | `tests/unit/hooks/useAuth.test.ts`     | URL normalization trims trailing slashes.            | `normalizeBaseUrl` returns the normalized origin/path.                                    |

## Timeline Page

| ID                | Type   | Source                                                | Case                                                                 | Expected Result                                                                                           |
| ----------------- | ------ | ----------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `TC-TIMELINE-001` | E2E    | `tests/e2e/us1-login-timeline.spec.ts`                | Timeline renders article cards after login.                          | At least one article card and heading are visible.                                                        |
| `TC-TIMELINE-002` | E2E    | `tests/e2e/us1-login-timeline.spec.ts`                | Active folder label is present.                                      | The hidden active-folder marker contains the current folder name.                                         |
| `TC-TIMELINE-003` | E2E    | `tests/e2e/us1-login-timeline.spec.ts`                | Scrolling keeps existing cards visible.                              | Card count does not shrink after scrolling.                                                               |
| `TC-TIMELINE-004` | E2E    | `tests/e2e/us1-login-timeline.spec.ts`                | Offline state is surfaced.                                           | The offline banner appears when `navigator.onLine` becomes false and disappears when online returns.      |
| `TC-TIMELINE-005` | E2E    | `tests/e2e/folder-queue-pills.spec.ts`                | Folder pills render in unread-priority order.                        | Pills appear in expected unread order and the first pill is selected.                                     |
| `TC-TIMELINE-006` | E2E    | `tests/e2e/folder-queue-pills.spec.ts`                | Selecting a folder pill pins it first and filters cards.             | The selected pill becomes first and only that folder’s cards remain visible.                              |
| `TC-TIMELINE-007` | E2E    | `tests/e2e/folder-queue-pills.spec.ts`                | Mark all read removes the active pill.                               | The active folder disappears from the pill list and the next folder becomes active.                       |
| `TC-TIMELINE-008` | E2E    | `tests/e2e/folder-queue-pills.spec.ts`                | Skip moves the active folder to the end.                             | The active folder pill is reordered to the end of the queue.                                              |
| `TC-TIMELINE-009` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Highest-priority folder is shown first.                              | The top unread folder becomes active and only its cards are shown initially.                              |
| `TC-TIMELINE-010` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | No unread items shows caught-up state.                               | “All caught up!” empty state is rendered.                                                                 |
| `TC-TIMELINE-011` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Mark all read advances to the next folder.                           | Bulk read API is called and the next folder becomes active.                                               |
| `TC-TIMELINE-012` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Automatic refresh runs on mount.                                     | Timeline data loads and the initial update flow is triggered.                                             |
| `TC-TIMELINE-013` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Manual refresh completes without losing existing state.              | Refresh button triggers another items request and the current view remains usable.                        |
| `TC-TIMELINE-014` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Queue progress survives reload.                                      | After reading a folder, reload keeps the next folder active.                                              |
| `TC-TIMELINE-015` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Refresh error preserves cached content.                              | The refresh button re-enables and current cards stay visible after a server failure.                      |
| `TC-TIMELINE-016` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Pending read IDs suppress reappearance before reconciliation.        | Already-read cards do not reappear even if the API still returns them.                                    |
| `TC-TIMELINE-017` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Reconciliation removes read items after refresh.                     | A read item remains visible until refresh, then disappears once the server omits it.                      |
| `TC-TIMELINE-018` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Global hotkeys trigger refresh, skip, and mark all read.             | `r`, `ArrowRight`, and `Enter` invoke the expected actions.                                               |
| `TC-TIMELINE-019` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Skipping through all folders leads to restart flow.                  | Repeated skip ends in “All folders viewed” and restart restores the queue.                                |
| `TC-TIMELINE-020` | E2E    | `tests/e2e/timeline-folders.spec.ts`                  | Opening an article shows the pop-out and marks it read.              | Clicking a card opens the dialog, triggers a mark-read request, and the card remains visible after close. |
| `TC-TIMELINE-021` | Unit   | `tests/unit/hooks/useTimeline.test.tsx`               | Queue sorting and active article derivation work from cached state.  | The hook exposes folders in expected order and returns the active folder’s cards.                         |
| `TC-TIMELINE-022` | Unit   | `tests/unit/hooks/useTimeline.test.tsx`               | Cached envelope can render without network data.                     | Offline cached data becomes the active timeline state.                                                    |
| `TC-TIMELINE-023` | Unit   | `tests/unit/hooks/useTimeline.test.tsx`               | Mark-all-read mutates queue state correctly.                         | The current folder is removed, `pendingReadIds` is tracked, and the next folder becomes active.           |
| `TC-TIMELINE-024` | Unit   | `tests/unit/hooks/useTimeline.test.tsx`               | Skip and restart mutate queue state correctly.                       | Skipped folders move to the end and restart restores them.                                                |
| `TC-TIMELINE-025` | Unit   | `tests/unit/hooks/useTimeline.test.tsx`               | Read items stay visible until sync reconciliation.                   | Locally read items remain in cache until a later refresh removes them.                                    |
| `TC-TIMELINE-026` | Unit   | `tests/unit/components/timeline/ArticleCard.test.tsx` | Article cards render fallback content and interaction semantics.     | Missing titles fall back, external links do not open the popout, and keyboard activation works.           |
| `TC-TIMELINE-027` | Unit   | `tests/unit/components/articlePopout.test.tsx`        | Article pop-out renders fetched content and close controls.          | Heading/body render correctly and the close button dismisses the dialog.                                  |
| `TC-TIMELINE-028` | Unit   | `tests/unit/components/articlePopout.test.tsx`        | Pop-out global Space handler closes the dialog.                      | Pressing Space dismisses the open pop-out.                                                                |
| `TC-TIMELINE-029` | Visual | `tests/visual/us1-login-timeline.spec.ts`             | Login, timeline, pop-out, and offline states remain visually stable. | Stored screenshots for key login and timeline states continue to match.                                   |
| `TC-TIMELINE-030` | Visual | `tests/visual/timeline-folders.spec.ts`               | Folder queue and timeline folder states remain visually stable.      | Stored screenshots for folder-focused timeline states continue to match.                                  |

## Feed Management Page

| ID             | Type | Source                                  | Case                                                         | Expected Result                                                                                                                                                                                                                                                               |
| -------------- | ---- | --------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TC-FEEDS-001` | E2E  | `tests/e2e/feeds-management.spec.ts`    | Unauthenticated access is blocked.                           | Visiting `/feeds` while signed out redirects to `/login`.                                                                                                                                                                                                                     |
| `TC-FEEDS-002` | E2E  | `tests/e2e/feeds-management.spec.ts`    | Shared burger menu orders timeline before feed management.   | Opening the burger menu shows timeline first, feed management second, and selecting feed management routes to `/feeds`.                                                                                                                                                       |
| `TC-FEEDS-003` | E2E  | `tests/e2e/feeds-management.spec.ts`    | Feed creation entry points open the subscription modal.      | The floating add button and `+` hotkey both open the add-feed modal.                                                                                                                                                                                                          |
| `TC-FEEDS-004` | E2E  | `tests/e2e/feeds-management.spec.ts`    | Feed table shows compact relative metadata and status icons. | The grouped feed table renders the expected column headers, folder subheader rows without subscription pills, relative timestamp values with hoverable exact local datetimes, hoverable feed URLs, and status icons with hoverable error text in a dedicated `Status` column. |
| `TC-FEEDS-005` | E2E  | `tests/e2e/feeds-management.spec.ts`    | Feed and folder CRUD flows update the page state.            | Create, rename, move through the modal, unsubscribe, and folder deletion actions refresh the rendered feed groups.                                                                                                                                                            |
| `TC-FEEDS-006` | Unit | `tests/unit/lib/feedManagement.test.ts` | Feed groups are sorted and uncategorized feeds are included. | Folder groups and feed rows are returned in alphabetical order with uncategorized items grouped.                                                                                                                                                                              |
| `TC-FEEDS-007` | Unit | `tests/unit/lib/feedManagement.test.ts` | Timestamp formatting handles missing and relative values.    | Absent timestamps render as `Not available` and populated timestamps render relative to now.                                                                                                                                                                                  |

## Current Gaps

- Several older unit tests in `tests/unit/hooks/useAuth.test.ts` are still placeholders and should not be treated as meaningful coverage beyond URL validation.
- The current automated suite does not provide strong coverage for queue docking, focus trap edge cases, or the hidden `?plain=1` login mode.
- The feed management suite currently focuses on the main CRUD path and does not yet cover subscription failure states or accessibility-specific assertions on `/feeds`.
