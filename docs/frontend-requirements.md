# Frontend Requirements Baseline

## Purpose

This document captures the frontend product requirements for the combined NewsBoxOne application.

The requirements should be phrased to stay implementation-agnostic wherever possible.

## Related Documents

- Test case catalog: `docs/frontend-test-cases.md`
- End-to-end scenarios: `frontend/docs/test-scenarios.md`
- Current stack and tooling: `docs/tech-stack.md`

## Requirement IDs

- IDs are stable and page-grouped.
- Prefixes:
  - `APP-*`: shared app shell and cross-page behavior
  - `LOGIN-*`: login page
  - `FEEDS-*`: feed management page
  - `TIMELINE-*`: timeline page

## Requirements

### Shared App Shell

- `APP-001`: The root route shall redirect authenticated users to `/timeline` and unauthenticated users to `/login`.
- `APP-002`: The application shall expose a skip link to `#main-content` for keyboard users.
- `APP-003`: The application shall wrap page content in a shared auth context and SWR data layer.
- `APP-004`: The application shall register a service worker from the client shell.
- `APP-005`: The application shall show an offline banner when the browser reports offline status and allow the banner to be dismissed until connectivity changes again.
- `APP-006`: The application shall render an always visible burger menu from the shared app shell.
- `APP-007`: The burger menu shall expose a manual PWA install action and disable it when installation is unavailable.
- `APP-008`: The application shall show an install prompt only when the browser provides an install event, the app is not already installed, and the user is not inside the 7-day dismissal cooldown.
- `APP-009`: Dismissing the install prompt shall persist a 7-day cooldown in `localStorage`.
- `APP-010`: An `appinstalled` event shall suppress future install prompts and clear dismissal state.
- `APP-011`: The shared burger menu shall list timeline before feed management and use the feed management entry to navigate to the feed management page.

### Login Page

- `LOGIN-001`: First-time and signed-out users shall be routed to the login page.
- `LOGIN-002`: The login page shall present a same-origin username/password form and shall not ask the user for a server URL.
- `LOGIN-003`: The username field shall be required and non-empty.
- `LOGIN-004`: The password field shall be required and non-empty.
- `LOGIN-005`: The login flow shall validate credentials against an existing protected NewsBoxOne API endpoint before persisting a session.
- `LOGIN-006`: Successful login shall store encoded Basic Auth credentials and redirect to `/timeline`.
- `LOGIN-007`: Failed authentication shall keep the user on the login page, preserve the username field, clear the password field, and show an inline error.
- `LOGIN-011`: Session data shall be stored in `sessionStorage` by default.
- `LOGIN-012`: When “remember device” is enabled, session data shall be stored in `localStorage` instead.
- `LOGIN-013`: When a remembered session exists, it shall be preferred over `sessionStorage` on startup.
- `LOGIN-014`: Failed authentication shall not create a stored session.
- `LOGIN-015`: Frontend-auth-related storage keys shall use the `newsboxone:*` namespace.

### Timeline Page

- `TIMELINE-001`: Unauthenticated access to `/timeline` shall redirect to `/login`.
- `TIMELINE-002`: The timeline shall hydrate from a locally stored cache before or while live data is fetched.
- `TIMELINE-003`: The timeline shall fetch folders, feeds, and unread items from the NewsBoxOne API and reconcile them into a client-side folder queue.
- `TIMELINE-004`: The folder queue shall be ordered by unread priority, with the active folder pinned to the front when selected.
- `TIMELINE-005`: When a feed has no folder assignment, its articles shall be grouped into an uncategorized folder bucket.
- `TIMELINE-006`: The timeline shall show only the active folder’s articles at a time.
- `TIMELINE-007`: The timeline shall derive article previews from stored article data, including title, feed name, author, summary, thumbnail, link target, and publication age when available.
- `TIMELINE-008`: The article title shall open the source article in a new tab.
- `TIMELINE-009`: Clicking or keyboard-activating the rest of an article card shall open an in-page article pop-out.
- `TIMELINE-010`: Opening an unread article shall optimistically mark it read.
- `TIMELINE-011`: The article pop-out shall fetch full article metadata and full HTML content on demand.
- `TIMELINE-012`: The article pop-out shall show a heading, subheading, and one of the following: fetched content, fallback body HTML, fallback summary text, loading UI, or an error or empty state.
- `TIMELINE-013`: The article pop-out shall trap focus while open, disable background page scrolling, and restore focus to the opener when closed.
- `TIMELINE-014`: The article pop-out shall close via the dedicated close button and via the global Space key handler implemented in the current code.
- `TIMELINE-015`: While the pop-out is open, the underlying timeline shall be marked `aria-hidden` and removed from keyboard interaction.
- `TIMELINE-016`: The folder queue shall become sticky after its sentinel scrolls out of view and shall release when scrolled back to the top.
- `TIMELINE-017`: When the queue is docked, the timeline layout shall offset content by the measured dock height so cards are not covered.
- `TIMELINE-018`: Scrolling articles past the top of the timeline shall batch optimistic mark-read updates without immediately removing those items from the current session view.
- `TIMELINE-019`: Arrow Up and Arrow Down shall select the topmost visible article first, then move selection through the current folder without wrapping.
- `TIMELINE-020`: Moving selection from one article to another via keyboard shall mark the previously selected article as read.
- `TIMELINE-021`: Space on the focused timeline shall open the selected article, or the topmost visible article if nothing is selected.
- `TIMELINE-022`: Timeline keyboard shortcuts shall be ignored while focus is inside text inputs, textareas, selects, or contenteditable fields.
- `TIMELINE-023`: The page shall provide floating actions for refresh, skip, and mark all read.
- `TIMELINE-024`: Pressing `r` shall trigger refresh when a sync is not already in progress.
- `TIMELINE-025`: Pressing `ArrowRight` shall skip the current folder when skipping is allowed.
- `TIMELINE-026`: Pressing `Enter` outside form fields shall trigger mark all read when that action is allowed.
- `TIMELINE-027`: Mark all read shall remove the current folder from the active queue, enqueue its item IDs for persistence, and advance to the next available folder.
- `TIMELINE-028`: Skip shall move the current folder to the end of the queue without marking its items read.
- `TIMELINE-029`: When every folder has been skipped or viewed, the page shall show an “All folders viewed” state with a restart action.
- `TIMELINE-030`: Restart shall restore skipped folders to the queue and reactivate the first queued folder.
- `TIMELINE-031`: When no unread items exist, the page shall show an “All caught up!” empty state.
- `TIMELINE-032`: When live refresh fails, the page shall preserve the current cached timeline, surface an error toast, and keep retry controls available.
- `TIMELINE-033`: The timeline shall automatically trigger a refresh after hydration for authenticated users.
- `TIMELINE-034`: The refresh action shall merge newly fetched unread items into the existing cache instead of discarding the current client view immediately.
- `TIMELINE-035`: Items marked read in the current session shall remain visible until a later sync reconciliation removes them.
- `TIMELINE-036`: Folder names and feed names already cached in article previews shall be updated when fresher folder/feed metadata arrives.
- `TIMELINE-037`: Timeline cache shall be stored in `localStorage` under a versioned key.

### Feed Management Page

- `FEEDS-001`: Unauthenticated access to `/feeds` shall redirect to `/login`.
- `FEEDS-002`: The feed management page shall fetch the current folder list and subscribed feed list when the page loads for an authenticated user.
- `FEEDS-003`: The page shall refresh its displayed folder and feed data after successful create, update, move, rename, or delete mutations performed on the page.
- `FEEDS-004`: The page shall provide a subscription form in a modal that accepts a feed URL and allows selecting an optional destination folder before submission.
- `FEEDS-005`: Successful subscription shall add the feed to the selected folder, or to an uncategorized group when no folder is selected.
- `FEEDS-006`: Failed subscription attempts shall preserve the user input and show actionable error feedback without removing the current page data.
- `FEEDS-007`: The page shall group subscribed feeds by folder in a table and shall show feeds without a folder assignment in an `Uncategorized` group.
- `FEEDS-008`: Feed groups and feed rows shall be ordered alphabetically by displayed name.
- `FEEDS-009`: Each feed row shall display the feed ID, feed name, last article date relative to the current time, next scheduled update time relative to the current time, a dedicated status indicator, and row actions in separate table columns.
- `FEEDS-009a`: Hovering the `Last Article` or `Next Update` value shall expose the exact timestamp in the viewer's local timezone formatted as `YYYY-MM-DD HH:mm:ss`.
- `FEEDS-010`: The page shall show feed update status as a centered icon in the `Status` column, using hover text to expose the concrete error message when the last update failed.
- `FEEDS-011`: The page shall provide a control to reassign a feed to a different folder, including moving it back to the uncategorized group, from a modal opened by a row action.
- `FEEDS-012`: The page shall allow deleting an individual feed only after explicit user confirmation.
- `FEEDS-013`: The page shall provide a dialog for creating a new folder.
- `FEEDS-014`: The page shall allow renaming an existing folder.
- `FEEDS-015`: The page shall allow deleting an existing folder only after explicit user confirmation.
- `FEEDS-016`: When confirming folder deletion, the page shall warn that deleting the folder will unsubscribe all feeds currently assigned to that folder.
- `FEEDS-017`: Confirmed folder deletion shall unsubscribe all feeds currently assigned to that folder and then remove the folder.
- `FEEDS-018`: The page shall expose the feed URL as hover text on the displayed feed name.
- `FEEDS-019`: A floating add-feed action shall open the subscription modal.
- `FEEDS-020`: Pressing the `+` key outside editable fields shall open the subscription modal.
