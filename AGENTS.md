# Engineering agents repository instructions

## Scope

This repository owns reusable role definitions and the scripts that install them
into other projects. Follow the current user request and keep changes scoped.

## Working rules

- Apply `standards/common.md`, `standards/testing.md`, `standards/security.md`, and `standards/git.md`.
- Use the relevant role instructions in `agents/`: planner, implementer,
  quick-implementer, debugger, reviewer, documenter, or git-integrator.
- Keep canonical role text in `agents/*.md`; do not hand-edit generated `.codex/agents/*.toml`.
- After changing roles or Codex rendering, run `npm run setup:repo` to regenerate this checkout's definitions.
- Keep install and sync behavior in `scripts/deployment.ts` so the adapters cannot drift.
- Preserve existing target files by default. Keep target Codex settings intact even with `--force`.
- Exercise installers only in temporary directories during tests.
- Update README.md and CHANGELOG.md for changes to commands or generated output.
- Only perform Git delivery operations when the user requests them.

## Verification

- Install locked dependencies with `npm ci`.
- Run `npm run build`, `npm run validate`, and `npm test` before handing off script changes.
- Report actual outcomes and any verification that could not run.

## Agent use

The `.codex/agents/` definitions are available for explicit delegation requests.
Use one primary agent by default. When delegation is requested, give each worker
a bounded task, avoid overlapping file ownership, and collect results before delivery.
