# Tech stack

This document provides a high-level overview of the technologies used in this
repository and how they fit together.

## Application runtime

- Primary language / framework: _[fill in here if needed]_
- Package management: _[fill in here if needed]_

## CI/CD

- Continuous integration: GitHub Actions
- Test & build: standard workflow jobs run on pull requests and main-branch pushes

## Containerization & deployment

The application is containerized and published as a Docker image:

- **Dockerfile**: A root-level `Dockerfile` defines the production image.
- **Buildx**: GitHub Actions uses Docker Buildx (via `docker/build-push-action`)
  to build the image, including support for multi-architecture builds where
  configured.
- **Registry**: Built images are pushed to GitHub Container Registry (GHCR) under
  the `ghcr.io/<OWNER>/<IMAGE-NAME>` namespace for this repository.

The CI workflow is responsible for:

- Building the Docker image from the root `Dockerfile`.
- Tagging the image (for example, with the commit SHA and/or release version).
- Publishing the image to GHCR using repository-scoped credentials.

For step-by-step instructions on how to deploy a new version using the published
Docker image, including any environment-specific details, see the **Deployment**
section in `README.md`, which serves as the current deployment runbook.

# Tech Stack

## Purpose

This document lists the technology and tooling currently used by NewsBoxZero.

## Product Shape

- Static web frontend for a headless RSS backend
- NewsBoxOne API consumer
- Progressive Web App with client-side caching, install prompt handling, and service worker registration

## Language And Runtime

- TypeScript 5.9
- Node.js 24+
- React 19

## Application Framework

- Next.js 16, App Router
- Static-export oriented frontend architecture
- Client-rendered data fetching for authenticated backend access

## Data Fetching And State

- SWR 2.4 for client-side data fetching and cache coordination
- React context for auth/session state
- Browser `localStorage` and `sessionStorage` for session persistence, timeline cache, install prompt cooldown, and lightweight preferences

## Styling And UI

- Tailwind CSS 4.1
- Global CSS in `src/styles/globals.css`
- Shared design tokens in `src/styles/tokens.css`
- Font Awesome for shared action and status iconography across the app
- `date-fns` 4.1 for relative time labels
- `next/image` for article thumbnails where available

## API Integration

- HTTP Basic Auth against the NewsBoxOne API under `/api`
- Typed API wrappers under `src/lib/api/`
- Client-side session normalization and validation before authenticated requests
- In local `next dev`, `/api/*` requests are proxied to the backend origin defined by `NEWSBOXONE_BACKEND_ORIGIN` and default to `http://127.0.0.1:8000`

## PWA And Browser Platform Features

- Web app manifest in `public/manifest.json`
- Service worker registration in the app shell
- Browser `beforeinstallprompt` and `appinstalled` handling
- Online/offline detection through browser events
- Performance marks for timeline cache and refresh timing

## Testing And Quality

- Vitest 4 for unit tests
- Testing Library for React component and hook tests
- Playwright for end-to-end and visual regression tests
- `@axe-core/playwright` for accessibility checks
- MSW 2 for API mocking in tests
- ESLint 9 and Prettier 3 for linting and formatting

## Build And Tooling

- npm-based scripts for linting, type checking, unit tests, e2e tests, and formatting
- Husky and lint-staged for pre-commit automation
- Static asset serving and export behavior configured through Next.js and repo scripts
