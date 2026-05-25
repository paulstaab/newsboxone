# NewsBoxOne Code Review Instructions

Use these instructions when reviewing a diff or pull request for this repository.

- Prioritize bugs, behavior regressions, missing validation, security issues, performance risks, and required documentation gaps.
- Present findings before summaries, ordered by severity and user impact.
- Keep comments actionable and evidence-based; reference the concrete file, behavior, or validation surface that supports the concern.
- Check for implementation mismatches against `docs/requirements.md`, `docs/backend-requirements.md`, and `docs/frontend-requirements.md` when the changed area is covered by those requirements.
- Check that relevant requirements are covered by the maintained test-case catalogs in `docs/backend-test-cases.md`, `docs/frontend-test-cases.md`, and `docs/e2e-test-cases.md` when the changed behavior should have integration or end-to-end coverage.
- Check that implemented integration and end-to-end tests still match the documented cases in `docs/backend-test-cases.md`, `docs/frontend-test-cases.md`, and `docs/e2e-test-cases.md`, and call out missing, stale, or undocumented test coverage.
- Check that `docs/tech-stack.md` is still current for the changed implementation and that the change obeys the documented stack choices and constraints.
- Explicitly check for duplicated code, duplicated logic, and abstractions that should be shared instead of copied.
- Explicitly check for code that is unnecessarily complicated for the problem being solved, including avoidable indirection, oversized abstractions, or convoluted control flow.
- Do not complain about unrelated changes in `docs/improvement-ideas.md`; treat that backlog as allowed background maintenance unless the current pull request directly depends on or misuses it.
- Avoid praise, diff summaries, and style-only nits unless they create a real correctness or maintenance risk.
- Call out missing updates to shared documentation when a change affects behavior covered by the repository documentation sync policy.
- If no actionable findings are present, say so explicitly and mention any residual testing or validation gaps.