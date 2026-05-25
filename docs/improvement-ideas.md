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

- Split the large feed-management route in `frontend/src/app/feeds/page.tsx` into focused table, dialog, and action components so page rendering is easier to review and test independently.

## Maintainability

- Reconcile frontend design tokens: several files reference undefined CSS variables such as `--color-primary`, `--color-text-secondary`, `--color-surface-elevated`, `--shadow-soft`, and `--shadow-xl`; align these references with `frontend/src/styles/tokens.css` or add the missing tokens intentionally.
- Break up the 1,100+ line `frontend/src/styles/globals.css` into feature-scoped style modules or smaller component layers for timeline, feed management, app shell, and overlays.

## Usability

- Consider supporting `Escape` to close the timeline article popout in `frontend/src/hooks/useArticlePopout.ts`; the close button works, but `Escape` is a common dialog expectation.

## Performance

## Testing

- Fix the lingering React `act(...)` warnings in `frontend/tests/unit/hooks/useTimeline.test.tsx`; they currently pass but mask asynchronous state-update timing issues in the timeline hook tests.
- Reduce Playwright integration noise by making the service-worker registration mock return a registration-like object, avoiding repeated `registration.addEventListener` errors in `frontend/src/lib/sw/register.ts` during tests.
- Add a lightweight frontend token audit test or lint script that fails when `var(--...)` references are not defined in `frontend/src/styles/tokens.css`.
- Refresh or remove stale visual Playwright coverage in `frontend/tests/visual/us1-login-timeline.spec.ts`; it still targets an older login flow with a server-URL step, includes a placeholder `expect(true)`, and overlaps newer timeline visual coverage.
- Replace fixed sleeps in PWA/visual Playwright tests with explicit install-prompt or UI readiness helpers so `frontend/tests/integration/pwa-install.spec.ts` and `frontend/tests/visual/pwa-install.spec.ts` are less timing-sensitive.
- Consolidate repeated Playwright setup constants and helpers, including auth storage-state paths, login helpers, breakpoint lists, and shared integration/visual config defaults.
- Reduce mock fixture drift by sharing typed mock builders between frontend Playwright route mocks and unit/MSW fixtures instead of maintaining large parallel mock payloads in `frontend/tests/integration/mocks.ts`.

## Documentation

## Developer & Agent Experience

## Packaging And Deployment
