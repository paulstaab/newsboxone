# NewsBoxZero Agent Instructions

## Purpose

This file is the single source of truth for repository-specific coding instructions.
Use it for any automated or agent-driven work in this repository.

## Project Overview

NewsBoxZero is a static-export-oriented Next.js frontend for a headless RSS backend that exposes the NewsBoxOne API.
The current product surface is centered on:

- shared app shell behavior
- login page behavior
- timeline page behavior
- PWA install and offline affordances

## Source Of Truth

When understanding or changing behavior, use these sources in this order:

1. implemented code in `src/`
2. automated tests in `tests/`
3. lightweight product docs in `docs/`

## Documentation That Must Stay In Sync

The following docs are part of the maintained product baseline and must stay aligned with the code:

- `../docs/frontend-requirements.md`
- `../docs/frontend-test-cases.md`
- `docs/test-scenarios.md`
- `docs/tech-stack.md`

Rules:

- When behavior changes, update the relevant docs in the same task.
- When tests change in a meaningful way, update `../docs/frontend-test-cases.md` and `docs/test-scenarios.md` as needed.
- When the stack, tooling, or core architecture changes, update `docs/tech-stack.md`.
- When the user asks for documentation updates, do not stop at code changes; keep the docs in sync as part of the request.
- If you notice the docs are materially out of sync with the code while working on a related area, fix them.

## Repository Structure

```text
src/
  app/              # Next.js App Router pages
  components/       # UI components
  hooks/            # React hooks
  lib/              # API clients, storage, config, utilities
  styles/           # Global styles and design tokens
  types/            # Shared TypeScript types
tests/
  e2e/              # Playwright end-to-end suites
  unit/             # Vitest unit tests
  visual/           # Visual regression suites
public/             # Static assets, manifest, service worker assets
docs/               # Maintained lightweight requirements and test docs
scripts/            # Helper scripts, including screenshot capture
```

## Current Stack

- TypeScript 5.9
- Node.js 24+
- Next.js 16 App Router
- React 19
- SWR 2.x
- Tailwind CSS 4.1
- date-fns 4.1
- Playwright
- Vitest
- Testing Library
- MSW

For the maintained stack description, see `docs/tech-stack.md`.

## Commands

- `npm run dev` - start the dev server
- `npm run build` - build the app
- `npm run start` - start the production server
- `npm run lint` - run ESLint
- `npm run lint:fix` - run ESLint with fixes
- `npm run typecheck` - run TypeScript checks
- `npm run format` - run Prettier write
- `npm run format:check` - run Prettier check
- `npm run test` - run unit tests
- `npm run test:coverage` - run unit tests with coverage
- `npm run test:e2e` - run Playwright e2e tests
- `npm run test:e2e:ui` - run Playwright e2e tests in UI mode

## Working Expectations

- Prefer `rg` for searching files and text.
- Keep changes consistent with existing patterns unless the user asks for a broader redesign.
- Use short comments only where they help explain non-obvious code.
- Add JSDoc or TSDoc to functions, classes, and React components when you create or substantially change them.
- Prefer small, targeted changes over speculative refactors.
- Preserve accessibility behavior when changing UI.
- Preserve static-export compatibility and client-side authenticated fetching patterns.

## Testing Expectations

- Always run `npm run lint` and `npm run test` before finishing, and fix issues you introduced.
- After significant behavior changes, also run `npm run test:e2e`.
- If you do not run a relevant test suite, say so clearly.

## Screenshots

Use these scripts when screenshots are needed:

- `./scripts/capture-timeline.sh`
- `./scripts/capture-feeds.sh`
- `./scripts/capture-login-page.sh`

These require network access and must run outside restricted sandboxes when applicable.

## Related Docs

- `../docs/frontend-requirements.md`
- `../docs/frontend-test-cases.md`
- `docs/test-scenarios.md`
- `docs/tech-stack.md`
