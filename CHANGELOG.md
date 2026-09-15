# Changelog

## Unreleased

- Resolve dangling output links before checking destination boundaries, and reject
  link cycles before writing files. Add regression coverage for these cases.
- Generate complete standalone Codex agents with names, descriptions, instructions,
  and role-specific sandbox defaults; replace legacy per-role config registrations.
- Share deployment logic between install and sync. Install both canonical roles and
  standards with either adapter; sync now refreshes active agent definitions and
  detects installed adapters unless explicitly selected.
- Preserve existing files by default and retain Codex project settings even during
  forced updates. Report write/preservation counts and reject invalid arguments,
  source-repository targets, and output links that escape the requested target.
- Add active root instructions and generated Codex roles for this repository, with
  `npm run setup:repo` to regenerate them from canonical sources.
- Add a TOML parser as a development dependency, validate generated metadata and
  drift, and add automated installer/sync regression coverage through `npm test`.
- Document installation, update behavior, migration, and local verification.

## 0.1.0 - 2026-09-03

- Added canonical directory structure for reusable engineering agents.
- Added role definitions, standards, adapters, templates, and TypeScript utilities.
- Added baseline repository metadata and documentation.
