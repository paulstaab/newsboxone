# Improvement Ideas

## Purpose

This document collects significant improvement and refactoring ideas encountered during coding sessions.
Use it as a lightweight planning backlog, not as a replacement for issue tracking or required documentation updates.

## Entry Guidelines

- Add ideas only when they are significant enough to deserve future planning, review, or implementation.
- Keep entries concise and actionable.
- Include file, subsystem, or workflow references when that context would help a future contributor.
- Sort entries under the most relevant category.
- It is fine for a coding session to add nothing.

## Ranked Implementation Order

Assessed on 2026-11-04 by ingestion reliability, shared-code reach, dependency order, effort, and regression risk. These are structural improvements; no user-visible behavior change is intended. Effort is relative (S/M/L), not a delivery estimate.

| Rank | Improvement | Impact / rationale | Effort | Status |
| --- | --- | --- | --- | --- |
| 1 | Separate backend update orchestration and feed quality | Isolates core ingestion, batch handling, and CLI/API quality operations; existing fixture coverage limits regression risk. | M | Implemented |
| 2 | Reuse typed backend persistence projections and mutations | Removes repeated feed-selection SQL and centralizes quality/refresh writes across the API and ingestion services; supports rank 1. | S | Implemented |
| 3 | Separate frontend API transport, authentication, and retry policy | Shared by every authenticated frontend workflow; creates a focused boundary for error and retry testing. | M | Pending |
| 4 | Separate timeline synchronization from presentation | Isolates cache restoration, refresh, and mutation reconciliation in the primary reading workflow. | L | Pending |
| 5 | Split feed management into feature modules | Reduces coupling among discovery, subscriptions, folders, and quality settings. | L | Pending |
| 6 | Inject backend external-service clients | Enables deterministic ingestion and enrichment tests; build on the extracted service boundaries. | L | Pending |
| 7 | Separate content extraction, quality evaluation, and summarization | Isolates network and LLM failure paths in core enrichment. | L | Pending |
| 8 | Decompose newsletter pipeline | Isolates mailbox transport, MIME parsing, cleanup, and persistence. | L | Pending |
| 9 | Move discovery and recommendations out of handlers | Makes network-heavy discovery logic reusable and easier to test. | M | Pending |
| 10 | Centralize backend time, randomness, and runtime mode | Makes scheduling and expiration deterministic; touches multiple domains. | L | Pending |
| 11 | Split backend integration fixtures by capability | Reduces fixture coupling as service and journey coverage grows. | M | Pending |
| 12 | Split backend repositories by domain | Feed selection and quality/refresh persistence now have a focused module; remaining folder/article/newsletter extraction follows service work. | L | Partial |
| 13 | Centralize frontend browser-platform adapters | Reduces browser-dependent mocking; introduce per feature rather than a broad platform rewrite. | L | Pending |
| 14 | Introduce shared frontend dialogs and forms | Consolidates repeated validation and accessibility behavior after feature boundaries are established. | M | Pending |
| 15 | Unify frontend icon-only buttons | Small consistency improvement with limited architectural reach. | S | Pending |
| 16 | Decompose settings-menu behavior and configuration | Local maintainability and focus-management improvement. | S | Pending |
| 17 | Separate generic and timeline metrics | Lower direct reliability impact than ingestion and synchronization boundaries. | M | Pending |

## Implemented Improvements

- **Backend update services:** `backend/src/updater.rs` coordinates batches and foreground maintenance; `backend/src/feed_refresh.rs` handles one feed's ingestion and cadence; `backend/src/feed_quality.rs` owns forced evaluation and manual overrides for CLI/API callers. Existing fixture tests continue to exercise these services together.
- **Typed feed persistence:** `backend/src/repo/feeds.rs` owns a shared `FeedRecord` projection, active/due/regular feed selection, and quality/refresh mutations. API listing, refresh, forced evaluation, manual overrides, and automatic quality checks use these helpers. Public payloads, lifecycle filters, timestamp semantics, and error behavior are preserved.

## Security

## Technical Debt

## Code Structure

- **Split frontend feed management into feature-level UI and state modules.** Break up `frontend/src/app/feeds/page.tsx` and `frontend/src/hooks/useFeedManagementPage.ts` into independently testable feed-list, folder-management, discovery, subscription, and quality-settings modules. Keep the route responsible for composition and move each workflow's state and mutations behind a focused hook or controller.
- **Separate frontend timeline synchronization from presentation and interaction state.** Extract refresh, unread reconciliation, cache restoration, and mutation orchestration from `frontend/src/hooks/useTimeline.ts` into a service with injected API, storage, clock, and timeout dependencies. Move Karakeep and keyboard-shortcut orchestration out of `frontend/src/app/timeline/page.tsx` so the route mainly composes the timeline UI.
- **Separate frontend API transport concerns.** Split `frontend/src/lib/api/client.ts` into a transport layer, authentication/token handling, retry policy, and domain clients.
- **Split generic frontend metrics collection from timeline metrics.** Separate persistence, performance measurements, and timeline-specific counters in `frontend/src/lib/metrics/metricsClient.ts`; expose small interfaces so features depend only on the metrics they emit.
- **Decompose the backend newsletter pipeline by responsibility.** Split `backend/src/email.rs` into mailbox transport, MIME parsing, HTML cleanup, LLM newsletter parsing, and newsletter persistence modules. Keep orchestration in a small service that composes these independently testable stages.
- **Separate backend content extraction, quality evaluation, and summarization.** Break up `backend/src/content.rs` into pure content-normalization helpers, article extraction, quality policy, and LLM summarization modules. Preserve a small enrichment service as the integration boundary.
- **Move feed discovery and recommendation workflows out of API handlers.** Extract discovery and candidate-verification logic from `backend/src/api/feeds.rs` and recommendation generation from `backend/src/api/recommendations.rs` into domain services. Keep handlers limited to request validation, service invocation, and response mapping.
- **Split the backend repository by domain ownership.** Replace the broad `backend/src/repo.rs` module with focused folder, feed, article, and newsletter repositories so callers depend on smaller APIs and SQL behavior can be reused without creating a catch-all persistence module.

## Maintainability

- **Introduce shared frontend dialog and form primitives.** Consolidate the repeated dialog shells, labels, inputs, validation messages, and action rows in the feed management page into reusable UI components with consistent accessibility behavior.
- **Unify frontend icon-only action buttons.** Replace the overlapping `frontend/src/components/feeds/FeedActionButton.tsx` and `frontend/src/components/timeline/TimelineActionButton.tsx` implementations with a shared icon-button primitive that supports size, visual intent, tooltip, loading, and disabled states.
- **Decompose frontend settings-menu behavior and configuration.** Extract dismiss/focus behavior into a reusable menu or popover hook and represent navigation actions declaratively in `frontend/src/components/ui/SettingsMenu.tsx`. Reuse the project's icon library instead of embedding menu-specific SVG markup.
- **Centralize backend time, randomness, and runtime-mode dependencies.** Replace scattered clock helpers, random jitter, and `testing_mode` branches with small injectable interfaces. This makes scheduling, token expiry, cleanup, and recency policies deterministic without test-only production branches.

## Usability

## Performance

## Testing

- **Centralize frontend browser-platform adapters.** Provide injectable wrappers for storage, dialogs, clocks, timers, performance APIs, generated IDs, fetch, delay, and randomness used across hooks and UI components. This reduces per-test mocking and makes browser-dependent behavior deterministic.
- **Split backend integration-test infrastructure by capability.** Decompose `backend/tests/integration_cases.rs` into scenario modules with shared server, HTTP, database, feed, IMAP, and LLM fixtures. This keeps scenario intent visible and makes fixtures reusable as integration coverage grows.
- **Inject backend external-service clients at service boundaries.** Define narrow interfaces for feed fetching, article fetching, IMAP access, and LLM completion so update, newsletter, content, and recommendation workflows can be tested without environment variables or local fixture servers when network behavior is not under test.

## Documentation

## Developer & Agent Experience

## Packaging And Deployment
