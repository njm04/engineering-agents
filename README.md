# engineering-agents

Canonical reusable repository for engineering agent definitions, standards, adapters, templates, and helper scripts.

## Structure

- `AGENTS.md`: active instructions for working on this repository
- `.codex/agents/`: generated, project-scoped Codex agents for this checkout
- `agents/`: reusable role definitions (`planner`, `implementer`, `quick-implementer`, `debugger`, `reviewer`, `documenter`, `git-integrator`)
- `standards/`: shared engineering standards and stack-specific guidelines
- `adapters/`: platform-specific templates for Copilot and Codex
- `templates/`: base `AGENTS.md` and project profile template
- `scripts/`: shared deployment logic and install, sync, setup, and validation commands
- `tests/`: regression tests that exercise both adapters in temporary directories

## Usage

Install Node.js 20 or later, then run `npm ci` in this repository.

### Install into another project

```sh
npm run install:agents -- /absolute/path/to/target-repo --adapter=codex
# Or use Copilot (the install default):
npm run install:agents -- /absolute/path/to/target-repo --adapter=copilot
```

On Windows, quote paths containing spaces:

```powershell
npm run install:agents -- "C:\Users\Your Name\Projects\my-app" --adapter=codex
```

Either adapter installs `AGENTS.md`, `project-profile.example.yml`, and all files
under `agents/` and `standards/`. No separate sync is needed to satisfy instruction
references. The project profile is an example for manual customization; scripts
do not consume its settings.

| Adapter | Active files |
| --- | --- |
| Codex | `.codex/agents/*.toml`, plus `.codex/config.toml` if absent |
| Copilot | `.github/agents/*.agent.md` and `.github/copilot-instructions.md` |

Codex definitions contain `name`, `description`, `developer_instructions`, and a
sandbox default. Planner and reviewer use `read-only`; the other roles use
`workspace-write`. Models and reasoning effort inherit from the parent session.
Agent names use underscores (`quick_implementer`, `git_integrator`) while source
filenames retain hyphens. Copilot planner and reviewer expose only read/search tools.

Current Codex discovers standalone agent files; per-role `config_file` entries
are no longer generated. See the [official custom agent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

### Update an installation

```sh
npm run sync:agents -- /absolute/path/to/target-repo --force
# Or limit active adapter output:
npm run sync:agents -- /absolute/path/to/target-repo --adapter=codex --force
```

Without `--adapter`, sync detects `.codex/agents/` and `.github/agents/` and updates
both when present. It defaults to Copilot when neither is installed. Sync uses the
same generator as install and also copies the `adapters/` and `templates/` source
directories for reference.

- Both commands preserve existing files by default and report written/preserved counts.
- `--force` replaces package-owned files, including root `AGENTS.md`, copied standards,
  and active agent definitions. Review or save project customizations first.
- Existing `.codex/config.toml` is **always preserved**, even with `--force`.
  New standalone agents work without merging role registrations into that file.
  Existing settings such as `agents.enabled = false` remain effective.
- Files outside the package's output paths are left in place; obsolete or renamed
  roles are not automatically deleted.
- Targets must be absolute and outside this source repository. Unknown options,
  invalid adapters, and links that redirect output outside the target are rejected.

For installations from the initial release, run sync with `--force` after reviewing
customizations. This fills missing standards and replaces active Codex files with
complete metadata. Since existing Codex config is preserved, review any legacy
`[agents.<role>]`/`config_file` registrations against your installed Codex version;
current standalone discovery does not need them.

### Work on this repository

The root `AGENTS.md` is active guidance, and `.codex/agents/` contains this repo's
seven generated agents. After editing canonical roles or Codex rendering:

```sh
npm run setup:repo
npm run validate
npm test
```

`setup:repo` regenerates only this checkout's owned `.codex/agents/*.toml` files.
It preserves root instructions and project settings. Commit regenerated agents
alongside their canonical changes. Request delegation explicitly when you want
multiple agents, for example: "Use planner to assess this change, then implement
it and have reviewer check the result." Start a new Codex session after setup so
it loads updated project instructions and definitions.

`npm test` first runs the TypeScript build, then tests fresh installs, repeated
installs, forced updates, adapter detection, configuration preservation, and
invalid destinations. `npm run validate` checks required files, instruction
references, TOML syntax and metadata, and drift in this checkout's generated agents.
These checks do not run live Codex or Copilot model sessions.

## Notes

This repository was shaped using established agent patterns from `njm04/massage-booking-app` and `njm04/massage-booking-app-spa`.
