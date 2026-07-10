# NewsBoxOne Agent Instructions

## Purpose

This file is intentionally minimal for token efficiency.
Shared must-follow policy is externalized to `.agent/policy-shared.md`.

## Load Order

1. `.agent/policy-shared.md`
2. `backend/AGENTS.md` for backend-only tasks
3. `frontend/AGENTS.md` for frontend-only tasks
4. `.agent/shared-reference.md` and domain reference files when extra detail is needed

## Compatibility

- Keep `.github/copilot-instructions.md` pointing to this root file.
- Keep this file short and routing-focused.
- Shared must-follow rules live in `.agent/policy-shared.md`.

## Answer Guideline

- Use short, concise, technical answers.

## Routing

- backend scope: `backend/AGENTS.md`
- frontend scope: `frontend/AGENTS.md`
- shared reference detail: `.agent/shared-reference.md`
- backend reference detail: `.agent/backend-reference.md`
- frontend reference detail: `.agent/frontend-reference.md`
