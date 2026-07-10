# Agent Instruction References

This directory contains reference material for coding agents.

Compatibility model:
- Primary instruction entrypoint remains `/.github/copilot-instructions.md`.
- Primary repository instruction file remains `/AGENTS.md`.
- Shared mandatory policy is externalized to `/.agent/policy-shared.md`.
- Domain-specific mandatory rules remain in `/backend/AGENTS.md` and `/frontend/AGENTS.md`.
- Files in this directory are policy and support files used to reduce token load in AGENTS files.

What should stay in AGENTS files:
- load order and routing between shared policy and domain policy
- compatibility entrypoint notes
- short answer-style reminder

What should live here:
- shared mandatory policy and constraints
- long command catalogs
- detailed repository structure maps
- troubleshooting playbooks
- optional examples and implementation notes
