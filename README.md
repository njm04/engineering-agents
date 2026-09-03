# engineering-agents

Canonical reusable repository for engineering agent definitions, standards, adapters, templates, and helper scripts.

## Structure

- `agents/`: reusable role definitions (`planner`, `implementer`, `quick-implementer`, `debugger`, `reviewer`, `documenter`, `git-integrator`)
- `standards/`: shared engineering standards and stack-specific guidelines
- `adapters/`: platform-specific templates for Copilot and Codex
- `templates/`: base `AGENTS.md` and project profile template
- `scripts/`: TypeScript utilities to install, sync, and validate repository content

## Usage

```bash
npm install
npm run validate
npm run install:agents -- /absolute/path/to/target-repo
npm run sync:agents -- /absolute/path/to/target-repo
```

Optional flags:

- `--adapter=copilot|codex` (default `copilot`)
- `--force` for overwrite behavior in install/sync

## Notes

This repository was shaped using established agent patterns from `njm04/massage-booking-app` and `njm04/massage-booking-app-spa`.
