# Claude Code Instructions

Use `AGENTS.md` at the repository root as the single source of truth for repository-specific instructions.

## Load Order

1. `AGENTS.md`
2. `.agent/policy-shared.md`
3. `backend/AGENTS.md` for backend-only tasks
4. `frontend/AGENTS.md` for frontend-only tasks
5. `.agent/shared-reference.md` and domain reference files when extra detail is needed

## Notes

- Keep this file short and routing-focused.
- Do not duplicate shared policy here.
- Keep Claude Code guidance aligned with `AGENTS.md` and `.github/copilot-instructions.md`.
