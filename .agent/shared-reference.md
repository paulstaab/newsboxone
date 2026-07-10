# Shared Reference (Optional Detail)

Use this file for low-frequency shared reference details.
Mandatory rules are in `/.agent/policy-shared.md` (with routing entrypoint in `/AGENTS.md`).

## Shared Infrastructure Ownership

The following are root-owned and should stay consolidated:

- `.devcontainer/devcontainer.json`
- `.vscode/tasks.json`
- `.vscode/settings.json`
- `.github/workflows/ci.yml`
- `.github/workflows/dependabot-auto-merge.yml`
- `Dockerfile`
- `docker/nginx.conf`
- `docker/entrypoint.sh`
- `docs/requirements.md`

Do not recreate per-project copies of shared devcontainer, CI, or root Docker packaging unless a task explicitly requires it.

## Improvement Ideas Log Guidance

Backlog file: `docs/improvement-ideas.md`.

- Add only significant ideas that plausibly need planning or review.
- Keep entries concise and actionable.
- Prefer categories such as technical debt, security, performance, testing, documentation, developer experience, and packaging.
- Use this backlog for future improvements, not as a replacement for required documentation sync in the current task.

## High-Signal Paths

- Root README: `README.md`
- Shared requirements: `docs/requirements.md`
- Shared API contract: `docs/api-contract.yaml`
- Shared tasks: `.vscode/tasks.json`
- Combined container build: `Dockerfile`
- Public proxy config: `docker/nginx.conf`
