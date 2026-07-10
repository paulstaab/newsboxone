# NewsBoxZero Agent Instructions

## Purpose

This file defines mandatory frontend-specific policy for coding agents.
It is intentionally concise to reduce token load.

Follow `../AGENTS.md` first for shared repository policy.
Use `../.agent/frontend-reference.md` for optional frontend details.

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
- `../docs/e2e-test-cases.md`
- `../docs/tech-stack.md`

Rules:

- When behavior changes, update the relevant docs in the same task.
- When tests change in a meaningful way, update `../docs/frontend-test-cases.md` and `../docs/e2e-test-cases.md` as needed.
- When the stack, tooling, or core architecture changes, update `../docs/tech-stack.md`.
- When the user asks for documentation updates, do not stop at code changes; keep the docs in sync as part of the request.
- If you notice the docs are materially out of sync with the code while working on a related area, fix them.

## Working Expectations

- Prefer `rg` for searching files and text.
- Keep changes consistent with existing patterns unless the user asks for a broader redesign.
- Use short comments only where they help explain non-obvious code.
- Add JSDoc or TSDoc to functions, classes, and React components when you create or substantially change them.
- Prefer small, targeted changes over speculative refactors.
- Preserve accessibility behavior when changing UI.
- Preserve static-export compatibility and client-side authenticated fetching patterns.

## Testing Expectations

- Always run `npm run lint`, `npm run test`, and `npm run test:integration` before finishing, and fix issues you introduced.
- After significant combined-product behavior changes, also run `npm run test:e2e`.
- If you do not run a relevant test suite, say so clearly.

## Related Docs

- `../docs/frontend-requirements.md`
- `../docs/frontend-test-cases.md`
- `../docs/e2e-test-cases.md`
- `../docs/tech-stack.md`
- `../.agent/frontend-reference.md`
