---
id: "5"
slug: cli-upgrade-command
status: done
depends-on:
  - contracts-config
  - core-upgrade-npm
  - core-upgrade-version
  - core-upgrade-child
---

# CLI: upgrade command handler

## Goal

Create `src/cli/commands/upgrade.ts` — the thin command handler that registers `scifi upgrade`, orchestrates the two-phase upgrade flow, and formats human/JSON output. Includes the internal `--_install` mode used by the child process.

## Tests first

- `tests/unit/cli/upgrade.test.ts` — unit-level command registration and option parsing (mock core modules):
  - Command is registered on program as `upgrade`.
  - `--yes` and `--json` flags are parsed correctly.
  - `--_install` flag is accepted (hidden from help text).
  - `--_install` mode skips npm phase and confirmation prompt, calls `installSkills` directly, outputs JSON to stdout.
  - Human output when `previousVersion > newVersion` (downgrade) produces direction-aware message (e.g. "Changing scifi from 1.1.0-pre to 1.0.0 (latest stable)").
- `tests/e2e/installed-upgrade.test.ts` — installed-build verification (see task 6 for full coverage; this task includes a smoke test that the command is registered and parseable).

## Work

1. Create `src/cli/commands/upgrade.ts`:
   - Export `registerUpgradeCommand(program: Command): void`.
   - Register `upgrade` command with `--yes`, `--json`, and `--_install` (hidden) flags.
   - **User-facing mode** (no `--_install`):
     a. Read config via `readConfig(cwd())`.
     b. Read current version via `readCurrentVersion(packageRoot)`.
     c. If not `--yes` and interactive: prompt y/N. On "no", exit 0 with message.
     d. Run `npmGlobalInstall('scifi')`. On failure, emit error and exit.
     e. Resolve new binary path: `npmGlobalPrefix()` → `resolveGlobalBinPath(prefix, 'scifi')`.
     f. Read new version via `readNewVersion(binPath)`.
     g. If versions equal: set `npmUpgraded = false`, skip to skill install.
     h. Spawn `spawnSkillInstall({ binPath, projectRoot: cwd(), harnesses })`.
     i. Emit success with combined result (version info + install report).
   - **Internal mode** (`--_install`):
     a. Read `--project-root` and `--harnesses` from args.
     b. Call `installSkills({ projectRoot, harnesses, packageRoot: findPackageRoot(import.meta.url) })`.
     c. Output `InstallReport` as JSON to stdout.
     d. Exit 0 if report produced, non-zero on catastrophic error.
   - JSON output shape (user-facing mode):
     ```json
     { "ok": true, "data": { "action": "upgrade", "previousVersion": "...", "newVersion": "...", "npmUpgraded": true/false, "harnesses": [...], "installed": [...], "failed": [...] } }
     ```
   - Human output: version change line, progress lines, per-harness install summary (follow `init` pattern).
   - Confirmation prompt: `readline` y/N, same pattern as `init`'s `askInteractively` but simpler.
   - Non-interactive without `--yes`: proceed (no prompt to block on).
2. Update `src/cli/index.ts`:
   - **Call site affected:** `buildProgram()` function (line 38-63).
   - Add `import { registerUpgradeCommand } from './commands/upgrade.js'`.
   - Add `registerUpgradeCommand(program)` call after existing registrations.
   - Additive change — no existing callers broken.

## Validation

```bash
npm run check && npm test -- --project unit
```

Unit tests for command registration and `--_install` mode pass. Smoke test confirms command is wired into the program.

## Satisfies

- Spec: `scifi upgrade` full flow (npm + child)
- Spec: version change display
- Spec: `--yes` skips confirmation
- Spec: `--json` structured output
- Spec: already at latest → skip npm, still re-install
- Spec: `cwd()` as project root
- Spec: confirmation prompt before acting
