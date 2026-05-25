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

## Maintainability

## Usability

- Consider supporting `Escape` to close the timeline article popout in `frontend/src/hooks/useArticlePopout.ts`; the close button works, but `Escape` is a common dialog expectation.

## Performance

## Testing

- Reduce Playwright integration noise by making the service-worker registration mock return a registration-like object, avoiding repeated `registration.addEventListener` errors in `frontend/src/lib/sw/register.ts` during tests.

## Documentation

## Developer & Agent Experience

## Packaging And Deployment
