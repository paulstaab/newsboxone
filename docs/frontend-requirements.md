# Frontend Requirements Baseline

## Purpose

This document captures the frontend product requirements for the combined NewsBoxOne application.

The requirements should be phrased to stay implementation-agnostic wherever possible.

This baseline records agreed target behavior. Updating it does not imply that the current implementation or automated tests already satisfy every requirement.

## Related Documents

- Frontend integration test catalog: `docs/frontend-test-cases.md`
- End-to-end scenario catalog: `docs/e2e-test-cases.md`
- Current stack and tooling: `docs/tech-stack.md`
- Frontend architecture and implementation guidance: `docs/tech-stack.md`, under Frontend Implementation Guidance

## Requirement IDs

- IDs are stable and page-grouped.
- Prefixes:
  - `APP-*`: shared app shell and cross-page behavior
  - `LOGIN-*`: login page
  - `FEEDS-*`: feed management page
  - `TIMELINE-*`: timeline page
  - `INTEGRATIONS-*`: integration settings
- Retired IDs shall not be reused. `TIMELINE-040` was moved to frontend implementation guidance because it specified React hook practices rather than product behavior.

## Requirements

### Shared App Shell

- `APP-001`: The root route shall redirect authenticated users to `/timeline` and unauthenticated users to `/login`.
- `APP-002`: The application shall expose a skip link to `#main-content` for keyboard users.
- `APP-003`: The application shall share authentication state and fetched data across pages.
- `APP-004`: The application shall register a service worker from the client shell.
- `APP-004a`: The service worker shall cache only same-origin static assets so cross-origin publisher images are loaded directly by the browser.
- `APP-005`: The application shall show an offline banner when the browser reports offline status and allow the banner to be dismissed until connectivity changes again.
- `APP-006`: The application shall render an always visible burger menu from the shared app shell.
- `APP-007`: The burger menu shall expose a manual PWA install action. When native installation prompting is unavailable, it shall show manual installation instructions where supported and otherwise explain that installation is unavailable.
- `APP-008`: The application shall show an install prompt only when the browser provides an install event, the app is not already installed, and the user is not inside the 7-day dismissal cooldown.
- `APP-009`: Dismissing the install prompt shall persist a 7-day cooldown in `localStorage`.
- `APP-010`: An `appinstalled` event shall suppress future install prompts and clear dismissal state.
- `APP-011`: The shared burger menu shall list timeline before feed management and use the feed management entry to navigate to the feed management page.
- `APP-012`: When an authenticated session exists, the shared burger menu shall expose a logout action that revokes the current backend-issued browser token, clears session data from both session and persistent browser storage, and routes the user to `/login`; if backend revocation fails, local sign-out shall still complete.
- `APP-013`: The shared burger menu shall expose an About entry that routes to `/about`.
- `APP-014`: Login, timeline, feed management, about, and integrations routes shall set a descriptive document title for the active page.
- `APP-015`: The shared burger menu shall expose an Integrations entry that routes to `/integrations`, where browser-local Karakeep connection settings are available without requiring backend Karakeep configuration.
- `APP-016`: The frontend shall provide a coherent responsive visual system across login, timeline, feed management, dialogs, menus, empty states, and integration settings in both light and dark color schemes.
- `APP-017`: When the deployment supplies `KARAKEEP_URL`, Karakeep integration settings shall use that URL and prevent the browser user from editing it while leaving the API key browser-local and editable.
- `APP-018`: The frontend shall meet WCAG 2.2 AA, including keyboard access, visible focus, contrast, zoom and reflow, and accessible status and error feedback. Information exposed on hover shall also be available to keyboard and touch users.
- `APP-019`: The frontend shall support the latest stable version of Chrome, Edge, Firefox, and Safari, including Android Chrome and iOS Safari.
- `APP-020`: The frontend shall support viewport widths down to 320 CSS pixels without horizontal page scrolling.
- `APP-021`: While offline, the frontend shall disable feed mutations and Karakeep save/delete actions and explain why they are unavailable.
- `APP-022`: If browser storage is unavailable or full, the frontend shall continue using in-memory state and clearly warn that the session and pending offline changes may be lost when the page closes.
- `APP-023`: An action shall be disabled while its request is pending to prevent duplicate submissions.
- `APP-024`: Results arriving after navigation away from a page or closure of a dialog shall not update stale UI. Successfully submitted mutations shall be reflected when the relevant page is loaded again; closing a dialog shall not imply that an already submitted mutation was canceled.
- `APP-025`: The About page shall remain accessible without login. Unauthenticated access to `/integrations` shall redirect to `/login`.

### Login Page

- `LOGIN-001`: First-time and signed-out users accessing the root or a protected route shall be routed to the login page; `/about` shall remain publicly accessible.
- `LOGIN-002`: The login page shall present a same-origin username/password form and shall not ask the user for a server URL.
- `LOGIN-003`: The username field shall be required and non-empty.
- `LOGIN-004`: The password field shall be required and non-empty.
- `LOGIN-005`: The login flow shall exchange credentials for a backend-issued browser token before persisting a session.
- `LOGIN-006`: Successful login shall store the issued auth token in browser session data and redirect to `/timeline`.
- `LOGIN-007`: Failed authentication shall keep the user on the login page, preserve the username field, clear the password field, and show an inline error.
- `LOGIN-008`: The login page shall preserve readable text and input contrast in both light and dark browser color schemes.
- `LOGIN-011`: Token-backed session data shall be stored in `sessionStorage` by default.
- `LOGIN-012`: When “remember device” is enabled, token-backed session data shall be stored in `localStorage` instead.
- `LOGIN-013`: When a remembered session exists, it shall be preferred over `sessionStorage` on startup.
- `LOGIN-014`: Failed authentication shall not create a stored session.
- `LOGIN-015`: Frontend-auth-related storage keys shall use the `newsboxone:*` namespace.
- `LOGIN-016`: When a session expires or the NewsBoxOne API rejects its token as invalid, the frontend shall clear the session and redirect to `/login` with a “Session expired” message. Connectivity failures and third-party authentication errors shall not be treated as NewsBoxOne session expiry.
- `LOGIN-017`: Logging out in one tab shall sign out all other open tabs using the same session.
- `LOGIN-018`: Logout or session expiry shall delete cached articles and discard pending offline read changes. Browser-local Karakeep configuration and its API key shall be retained for subsequent sign-in, subject to authenticated access to integration settings.

### Timeline Page

- `TIMELINE-001`: Unauthenticated access to `/timeline` shall redirect to `/login`.
- `TIMELINE-002`: The timeline shall hydrate from a locally stored cache before or while live data is fetched.
- `TIMELINE-003`: The timeline shall fetch folders, feeds, and unread items from the NewsBoxOne API and reconcile them into a client-side folder queue.
- `TIMELINE-004`: Eligible folders shall be ordered by unread article count descending, then alphabetically by displayed folder name, then by folder ID for identical names. The active folder shall be pinned to the front when selected; skipped folders shall remain ineligible until Restart.
- `TIMELINE-005`: When a feed has no folder assignment, its articles shall be grouped into an uncategorized folder bucket.
- `TIMELINE-006`: The timeline shall show only the active folder’s articles at a time.
- `TIMELINE-007`: The timeline shall derive article previews from stored article data, including title, feed name, feed type, author, summary, thumbnail, link target, and publication age when available.
- `TIMELINE-007a`: Timeline article metadata shall show an email icon for articles whose feed type is `mailingList`.
- `TIMELINE-008`: The article title shall open the source article in a new tab.
- `TIMELINE-009`: Clicking the rest of an article card or activating it with Space shall open an in-page article pop-out. Enter on the card shall mark the current folder read as specified in `TIMELINE-026`.
- `TIMELINE-010`: Opening an unread article in the pop-out or opening its source title in a new tab shall optimistically mark it read immediately. Failure to load article content shall not restore unread status.
- `TIMELINE-011`: The article pop-out shall fetch full article metadata and full HTML content on demand.
- `TIMELINE-012`: The article pop-out shall show a heading, subheading, and one of the following: fetched content, fallback body HTML, fallback summary text, loading UI, or an error or empty state.
- `TIMELINE-012a`: Fetched article HTML and fallback article body HTML shall be sanitized before rendering so publisher-controlled content cannot execute scripts, event handlers, unsafe URL schemes, forms, frames, or inline styles.
- `TIMELINE-013`: The article pop-out shall trap focus while open, disable background page scrolling, and restore focus to the opener when closed.
- `TIMELINE-014`: The article pop-out shall close via its dedicated close button, Space, or Escape. Space dismissal shall be ignored while focus is inside an editable field.
- `TIMELINE-015`: While the pop-out is open, the underlying timeline shall be marked `aria-hidden` and removed from keyboard interaction.
- `TIMELINE-016`: The folder queue shall remain visible at the top of the reading area after scrolling past its normal position and shall return to its normal position when scrolled back to the top.
- `TIMELINE-017`: When the folder queue is docked, the timeline layout shall leave enough space that article cards are not covered.
- `TIMELINE-018`: A previously visible article card shall be optimistically marked read once it has fully passed above the reading area. These updates shall be batched without immediately removing the cards from the current view.
- `TIMELINE-019`: Arrow Up and Arrow Down shall select the topmost visible article first, then move selection through the current folder without wrapping.
- `TIMELINE-020`: Moving selection from one article to another via keyboard shall mark the previously selected article as read.
- `TIMELINE-021`: Space on the timeline background or an article card shall open the selected article, or the topmost visible article if nothing is selected. Focused links and buttons shall retain their native keyboard activation behavior.
- `TIMELINE-022`: Timeline keyboard shortcuts shall be ignored while focus is inside text inputs, textareas, selects, or contenteditable fields, and while an article pop-out, menu, or other dialog is open. The pop-out's own Space and Escape dismissal behavior shall remain available.
- `TIMELINE-023`: The page shall provide floating actions for refresh, skip, and mark all read.
- `TIMELINE-024`: Pressing `r` shall trigger refresh when a sync is not already in progress.
- `TIMELINE-025`: Pressing `ArrowRight` shall skip the current folder when skipping is allowed.
- `TIMELINE-026`: Pressing Enter on the timeline background or an article card shall mark the current folder read when that action is allowed. Enter on a focused link or button shall activate that control instead. Editable-field and overlay exclusions in `TIMELINE-022` shall apply.
- `TIMELINE-027`: Mark all read shall remove the current folder from the active queue, enqueue its item IDs for persistence, and advance to the next available folder.
- `TIMELINE-028`: Skip shall exclude the current folder from active selection without marking its items read and advance to the next eligible folder. Skipped folders shall not cycle back automatically.
- `TIMELINE-029`: When every folder in the current pass has been skipped or marked read, the page shall show an “All folders viewed” state with a restart action.
- `TIMELINE-030`: Restart shall restore skipped folders to eligibility and reactivate the first folder according to `TIMELINE-004`.
- `TIMELINE-031`: When an initial load or explicit refresh finds no unread items, the page shall show an “All caught up!” empty state. Completing the current folder pass shall use `TIMELINE-029`.
- `TIMELINE-032`: When live refresh fails and cached articles exist, the page shall preserve the cached timeline, surface an error toast, and keep retry controls available. If the first load fails without cached articles, the page shall show a dedicated error state with Retry, distinct from “All caught up!”.
- `TIMELINE-033`: The timeline shall automatically trigger a refresh after hydration for authenticated users.
- `TIMELINE-034`: The refresh action shall merge newly fetched unread items into the existing cache instead of discarding the current client view immediately.
- `TIMELINE-035`: Individually marked-read articles shall remain visible until explicit refresh or leaving the timeline; automatic sync shall not remove them from the current view. Marking a whole folder read shall still advance and remove that folder from the active queue as specified in `TIMELINE-027`.
- `TIMELINE-036`: Folder names and feed names already cached in article previews shall be updated when fresher folder/feed metadata arrives.
- `TIMELINE-037`: Timeline cache shall be stored in `localStorage` under a versioned key.
- `TIMELINE-038`: Unread timeline sync shall page through backend item-id boundaries without skipping unread items between pages.
- `TIMELINE-039`: Read mutations definitively rejected by the server shall restore affected articles as unread locally and clear their pending read state. If a folder-level mutation fails after advancing, its folder shall return to the queue without replacing the currently active folder. Offline or connectivity-related failures shall remain pending for retry as specified in `TIMELINE-044`.
- `TIMELINE-041`: When browser-local Karakeep is enabled and verified, each timeline article card shall expose a save-to-Karakeep action, highlight it when saved, and delete the Karakeep bookmark when the highlighted action is activated again. Saved indicators shall be restored after page reload by checking Karakeep. If status cannot be checked, cards shall show an unknown state with Retry and disable save/delete until status is known.
- `TIMELINE-042`: On touch devices, long-pressing a timeline article card shall save it to Karakeep without opening the article. Long-pressing an already saved article shall leave it saved; deletion shall require activating the highlighted save action.
- `TIMELINE-043`: Articles within each folder shall be ordered by publication timestamp descending, then by article ID descending when timestamps are equal.
- `TIMELINE-044`: Offline read actions shall apply locally and persist pending changes in browser storage, subject to the in-memory fallback in `APP-022`. Pending changes shall be retried when connectivity returns and shall survive reload when storage is available. Logout and session expiry shall discard them as specified in `LOGIN-018`.
- `TIMELINE-045`: Cache age and item-count limits shall apply only to offline storage and shall not prevent any unread article from being accessed online.
- `TIMELINE-046`: Corrupted or incompatible timeline caches shall be discarded and replaced by freshly fetched data. If fetching fails with no usable cache, the dedicated error state in `TIMELINE-032` shall be shown.

### Feed Management Page

- `FEEDS-001`: Unauthenticated access to `/feeds` shall redirect to `/login`.
- `FEEDS-002`: The feed management page shall fetch the current folder list and subscribed feed list when the page loads for an authenticated user.
- `FEEDS-003`: The page shall refresh its displayed folder and feed data after successful create, update, move, rename, or delete mutations performed on the page.
- `FEEDS-004`: The page shall provide a subscription form in a modal that accepts a feed URL and allows selecting an optional destination folder before submission.
- `FEEDS-005`: Successful subscription shall add the feed to the selected folder, or to an uncategorized group when no folder is selected.
- `FEEDS-006`: Failed subscription attempts shall preserve the user input and show actionable error feedback without removing the current page data.
- `FEEDS-006a`: When the subscription form receives a URL that does not look like a direct RSS or Atom feed URL, the page shall discover embedded RSS/Atom feeds before creating a subscription.
- `FEEDS-006b`: If discovery returns one feed, the page shall subscribe automatically; if discovery returns multiple feeds, the dialog shall show title-and-URL choices and subscribe only after the user selects one.
- `FEEDS-006c`: The feed management page shall expose a `Discover feeds` action that opens a focused recommendation modal.
- `FEEDS-006d`: The recommendation modal shall generate RSS/Atom recommendations only after explicit user action and shall not auto-load recommendations when the page opens.
- `FEEDS-006e`: While recommendations are being generated, the modal shall show simple progress stages for analyzing subscriptions, finding feeds, and verifying feeds.
- `FEEDS-006f`: Closing the recommendation modal while generation is in progress shall abort or ignore the in-flight request without mutating page state.
- `FEEDS-006g`: Feed recommendations shall show the recommended feed title, URL, source site when available, topics when available, and a short AI-generated reason before the user subscribes.
- `FEEDS-006h`: Activating a recommendation shall open the normal subscription confirmation flow with the verified URL fixed, allow choosing a destination folder, and create the feed only after explicit confirmation.
- `FEEDS-006i`: After a successful subscription from the recommendation modal, the modal shall remain open, remove the subscribed recommendation from the visible results, and refresh the feed list.
- `FEEDS-006j`: Regenerating recommendations from the modal shall replace the current recommendation results rather than appending to them.
- `FEEDS-006k`: If recommendations are unavailable, insufficient subscriptions exist, or no verified candidates are found, the page shall show a non-blocking empty state and keep normal feed management usable; unexpected generation failures shall show a visible error.
- `FEEDS-006l`: If discovery returns no feeds, the dialog shall preserve the entered URL, show “No feeds found,” and allow editing and retrying without creating a subscription.
- `FEEDS-007`: The page shall group subscribed feeds by folder in a table and shall show feeds without a folder assignment in an `Uncategorized` group.
- `FEEDS-008`: Feed groups and feed rows shall be ordered alphabetically by displayed name.
- `FEEDS-009`: Each feed row shall display the feed title as the feed name without exposing the internal feed ID, the last article date relative to the current time, a dedicated status indicator, and row actions in separate table columns.
- `FEEDS-009b`: The `Last Article` value shall come from the feed metadata returned by the feeds API so it remains available even after article cleanup removes old item rows.
- `FEEDS-009a`: Hovering the `Last Article` value shall expose the exact timestamp in the viewer's local timezone formatted as `YYYY-MM-DD HH:mm:ss`.
- `FEEDS-010`: The page shall show feed update status as a centered icon in the `Status` column, using hover text to expose the concrete error message when the last update failed.
- `FEEDS-011`: The page shall allow editing a feed's title and assigned folder, including moving it back to the uncategorized group, from the per-feed settings dialog opened by a row action.
- `FEEDS-012`: The page shall allow deleting an individual feed only after explicit user confirmation.
- `FEEDS-013`: The page shall provide a dialog for creating a new folder.
- `FEEDS-014`: The page shall allow renaming an existing folder.
- `FEEDS-015`: The page shall allow deleting an existing folder only after explicit user confirmation.
- `FEEDS-016`: When confirming folder deletion, the page shall warn that deleting the folder will unsubscribe all feeds currently assigned to that folder.
- `FEEDS-017`: Confirmed folder deletion shall unsubscribe all feeds currently assigned to that folder and remove the folder only after every unsubscribe succeeds. If any unsubscribe fails, the folder and failed feeds shall remain, the page shall identify the failures and allow retry, and successfully deleted feeds shall stay deleted.
- `FEEDS-018`: The per-feed settings dialog shall display the feed URL as a clickable link that opens the source in a new tab.
- `FEEDS-019`: The page shall provide a floating action cluster for updating feeds, creating folders, and opening the subscription modal.
- `FEEDS-020`: Pressing the `+` key outside editable fields shall open the subscription modal.
- `FEEDS-021`: The page shall provide a per-feed settings dialog from a row action.
- `FEEDS-022`: The feed settings dialog shall let the user set `Extract full text` and `Create LLM Summaries` independently to `Automatic (Enabled/Disabled)`, `Enabled`, or `Disabled`. Automatic shall use the backend's automatic decision and display its effective Enabled/Disabled state.
- `FEEDS-023`: Saving feed settings shall submit the current title, folder, and both selected feed-quality preferences together, refresh the displayed feed state, and surface a success message without requiring a full page reload.
- `FEEDS-024`: The feed settings dialog shall show editable `Title`, editable `Folder`, a clickable `URL`, `Last Article`, `Next Scheduled Update`, and `Last Quality Check` for the selected feed.
- `FEEDS-025`: The feed settings dialog shall provide `Cancel` and `Save` actions and shall not expose a separate re-evaluate action.
- `FEEDS-026`: Duplicate feed subscriptions shall be prevented. The page shall explain that the feed is already subscribed and offer to open its settings.
- `FEEDS-027`: Folder creation and renaming shall trim surrounding whitespace and reject blank names and duplicate names regardless of capitalization.
- `FEEDS-028`: Missing timestamps shall display “No articles yet” for Last Article, “Not scheduled” for Next Scheduled Update, and “Never” for Last Quality Check.

### Integrations Page

- `INTEGRATIONS-001`: Integration settings shall require authentication, while keeping Karakeep connection details and API keys browser-local.
- `INTEGRATIONS-002`: Changing the effective Karakeep URL or API key shall invalidate connection verification and disable the integration until verification succeeds again, including when the deployment-provided URL changes.
- `INTEGRATIONS-003`: Karakeep shall be enabled only after its connection has been successfully verified. Connection verification failures shall show actionable feedback.
- `INTEGRATIONS-004`: Logout shall retain the browser-local Karakeep API key and connection configuration. Retained settings shall be accessible through the Integrations page only after signing in again.
