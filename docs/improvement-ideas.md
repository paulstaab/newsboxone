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

## Security

## Technical Debt

## Code Structure

- **Split frontend feed management into feature-level UI and state modules.** Break up `frontend/src/app/feeds/page.tsx` and `frontend/src/hooks/useFeedManagementPage.ts` into independently testable feed-list, folder-management, discovery, subscription, and quality-settings modules. Keep the route responsible for composition and move each workflow's state and mutations behind a focused hook or controller.
- **Separate frontend timeline synchronization from presentation and interaction state.** Extract refresh, unread reconciliation, cache restoration, and mutation orchestration from `frontend/src/hooks/useTimeline.ts` into a service with injected API, storage, clock, and timeout dependencies. Move Karakeep and keyboard-shortcut orchestration out of `frontend/src/app/timeline/page.tsx` so the route mainly composes the timeline UI.
- **Separate frontend API transport concerns.** Split `frontend/src/lib/api/client.ts` into a transport layer, authentication/token handling, retry policy, and domain clients.
- **Split generic frontend metrics collection from timeline metrics.** Separate persistence, performance measurements, and timeline-specific counters in `frontend/src/lib/metrics/metricsClient.ts`; expose small interfaces so features depend only on the metrics they emit.
- **Split backend update orchestration from feed-quality management.** Decompose `backend/src/updater.rs` into a batch update coordinator, a single-feed refresh service, and a feed-quality service. Move feed selection and quality persistence behind focused repository functions so CLI and API callers reuse the same domain operations.
- **Decompose the backend newsletter pipeline by responsibility.** Split `backend/src/email.rs` into mailbox transport, MIME parsing, HTML cleanup, LLM newsletter parsing, and newsletter persistence modules. Keep orchestration in a small service that composes these independently testable stages.
- **Separate backend content extraction, quality evaluation, and summarization.** Break up `backend/src/content.rs` into pure content-normalization helpers, article extraction, quality policy, and LLM summarization modules. Preserve a small enrichment service as the integration boundary.
- **Move feed discovery and recommendation workflows out of API handlers.** Extract discovery and candidate-verification logic from `backend/src/api/feeds.rs` and recommendation generation from `backend/src/api/recommendations.rs` into domain services. Keep handlers limited to request validation, service invocation, and response mapping.
- **Split the backend repository by domain ownership.** Replace the broad `backend/src/repo.rs` module with focused folder, feed, article, and newsletter repositories so callers depend on smaller APIs and SQL behavior can be reused without creating a catch-all persistence module.

## Maintainability

- **Introduce shared frontend dialog and form primitives.** Consolidate the repeated dialog shells, labels, inputs, validation messages, and action rows in the feed management page into reusable UI components with consistent accessibility behavior.
- **Unify frontend icon-only action buttons.** Replace the overlapping `frontend/src/components/feeds/FeedActionButton.tsx` and `frontend/src/components/timeline/TimelineActionButton.tsx` implementations with a shared icon-button primitive that supports size, visual intent, tooltip, loading, and disabled states.
- **Decompose frontend settings-menu behavior and configuration.** Extract dismiss/focus behavior into a reusable menu or popover hook and represent navigation actions declaratively in `frontend/src/components/ui/SettingsMenu.tsx`. Reuse the project's icon library instead of embedding menu-specific SVG markup.
- **Centralize backend time, randomness, and runtime-mode dependencies.** Replace scattered clock helpers, random jitter, and `testing_mode` branches with small injectable interfaces. This makes scheduling, token expiry, cleanup, and recency policies deterministic without test-only production branches.
- **Reuse typed backend persistence projections and mutations.** Centralize repeated feed projections and quality-state SQL shared by `backend/src/updater.rs`, API handlers, and repository functions to reduce schema coupling and keep update semantics consistent.

## Usability

## Performance

## Testing

- **Centralize frontend browser-platform adapters.** Provide injectable wrappers for storage, dialogs, clocks, timers, performance APIs, generated IDs, fetch, delay, and randomness used across hooks and UI components. This reduces per-test mocking and makes browser-dependent behavior deterministic.
- **Split backend integration-test infrastructure by capability.** Decompose `backend/tests/integration_cases.rs` into scenario modules with shared server, HTTP, database, feed, IMAP, and LLM fixtures. This keeps scenario intent visible and makes fixtures reusable as integration coverage grows.
- **Inject backend external-service clients at service boundaries.** Define narrow interfaces for feed fetching, article fetching, IMAP access, and LLM completion so update, newsletter, content, and recommendation workflows can be tested without environment variables or local fixture servers when network behavior is not under test.

## Documentation

## Developer & Agent Experience

## Packaging And Deployment
