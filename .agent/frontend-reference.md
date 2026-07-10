# Frontend Reference (Optional Detail)

Use this file for frontend reference details.
Mandatory frontend policy is in `/frontend/AGENTS.md`.

## Current Stack Detail

Canonical stack details live in `docs/tech-stack.md`.

## Command Catalog

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run format`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration`
- `npm run test:visual`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run test:e2e:ui`

## Repository Map

- App routes: `src/app/`
- Components: `src/components/`
- Hooks: `src/hooks/`
- API and utilities: `src/lib/`
- Styles and tokens: `src/styles/`
- Unit tests: `tests/unit/`
- Frontend integration tests (mocked API): `tests/integration/`
- Visual tests: `tests/visual/`
- Static assets and PWA files: `public/`

## Screenshot Scripts

- `./scripts/capture-timeline.sh`
- `./scripts/capture-feeds.sh`
- `./scripts/capture-login-page.sh`

These scripts need network access and are best run outside restricted sandboxes.
