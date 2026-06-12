# Spec: CLI upgrade command

- **Slug:** cli-upgrade-command

## Problem / Why

Users who installed `scifi` globally and initialized it in a repo have no built-in way to upgrade the CLI to the latest version and refresh the installed skills. Today they must manually run `npm install -g scifi@latest` and then re-run `scifi init` (which re-scaffolds files they may not want touched). A single `scifi upgrade` command makes this a one-step operation: upgrade the tool, detect which harnesses are already configured, and re-install the latest skills into those harnesses — nothing more, nothing less.

## Scope

### In scope

- `scifi upgrade` command that performs two phases:
  1. Runs `npm install -g scifi@latest` to upgrade the global CLI binary.
  2. Spawns a child process from the **new** binary to re-install skills into the harnesses recorded in the repo's config. The parent resolves the new binary path by running `npm prefix -g` to find the global install prefix, then appending `bin/scifi` (or the platform-equivalent `.cmd`/`.ps1` on Windows), and spawning that path directly — avoiding shell PATH caching.
- Reads harness configuration from `docs/scifi/.scifi/config.json` (the file written by `scifi init`).
- Shows version change: "Upgrading scifi from X.Y.Z to A.B.C".
- Confirmation prompt before acting, skippable with `--yes`.
- `--json` flag for structured machine-readable output (same pattern as `scifi init`).
- Clear error messages for: missing config, malformed config, npm failure, permission denied, child process failure.
- Graceful handling of already-at-latest: skip npm phase, still re-install skills.
- Graceful handling of invalid harnesses in config: skip with warning, proceed with valid ones.

### Out of scope (non-goals)

- Touching scaffolding files (`CONTEXT.md`, `docs/scifi/` directory structure). Those belong to `scifi init`.
- Adding/removing harnesses during upgrade. To change harness selection, re-run `scifi init`.
- A `--harness` flag on upgrade. Harness selection is owned by config, not by upgrade.
- Upgrading locally-installed (non-global) scifi.
- Rolling back to a previous version.
- Checking for newer versions without acting (no "check" or "dry-run" subcommand).
- Upgrading anything other than scifi itself and its skills.

## Acceptance criteria

- [ ] `scifi upgrade` in a repo with valid config runs `npm install -g scifi@latest`, then spawns a child process that re-installs skills into the configured harnesses.
- [ ] `scifi upgrade` prints the version change (from → to) in human-readable output.
- [ ] `scifi upgrade --yes` skips the confirmation prompt and proceeds immediately.
- [ ] `scifi upgrade --json` outputs structured JSON with top-level keys: `action` (`"upgrade"`), `previousVersion`, `newVersion`, `npmUpgraded` (boolean — false if already at latest), `harnesses` (array of harness IDs from config), `installed` (array of `{ harness, baseDir, skills }` where `skills` is an array of installed skill IDs), and `failed` (array of `{ harness, error }` for any harness install failures).
- [ ] When already at the latest npm version, the npm phase is skipped but skills are still re-installed.
- [ ] When `docs/scifi/.scifi/config.json` is missing, the command errors with: "scifi not initialized here — run `scifi init` first."
- [ ] When `config.json` is malformed (missing `harnesses` key, `harnesses` is not an array, or the array contains non-string entries), the command errors with a clear message pointing to `scifi init` for repair.
- [ ] When `npm install -g` fails (network, permissions), the command errors out before attempting skill re-install. Permission errors include a hint about sudo/npm prefix.
- [ ] When the child process (skill re-install) fails, the parent reports the failure with the child's error output.
- [ ] When config lists a harness that is no longer valid in the current scifi version, that harness is skipped with a warning; valid harnesses proceed normally.
- [ ] When config lists zero valid harnesses after filtering (including an initially-empty `harnesses` array), the command errors with a clear message.
- [ ] The command uses `cwd()` directly as the project root (same as `scifi init`). It does not walk up the directory tree. If `docs/scifi/.scifi/config.json` is not found at `cwd()`, the command errors with the "not initialized" message.
- [ ] End-to-end test verifies the full flow: init a repo with harnesses, simulate upgrade, confirm skills land in the correct harness dirs.
- [ ] Installed-build verification: the packaged CLI's `upgrade` command behaves correctly (npm phase verified with a mock or controlled environment; skill phase verified against real harness dirs).

## Architecture & Context impact

- **Modules touched:**
  - New: `src/cli/commands/upgrade.ts` — thin command handler (Commander registration, option parsing, output formatting).
  - New: `src/core/upgrade/` — core logic: npm spawn, config reading, version detection, child-process handoff.
  - Modified: `src/core/init/config.ts` — add `readConfig()` function (currently only `writeConfig()` exists).
  - Reused (no changes expected): `src/core/init/install-skills.ts` (InstallSkillsOptions, InstallReport, installSkills), `src/core/skills/harness/adapter.ts` (HarnessId, KNOWN_HARNESS_IDS, isHarnessId), `src/core/package-root.ts` — used internally by the child process to locate its own bundled skills (no changes needed).
- **New CONTEXT.md terms:** none — "upgrade" is a CLI command, not a domain concept.
- **ADRs:** none — the design follows existing patterns (config as source of truth per init, per-harness install per ADR 0001, thin-command/thick-core module boundary). No new non-obvious trade-off.

## Edge cases & open questions

- **Edge cases:**
  - `npm` not installed on the system: the `npm install -g` spawn fails; error message should mention npm may not be available.
  - `npm prefix -g` fails during binary path resolution: treated as an npm failure; error message includes the npm stderr.
  - New binary missing at resolved path after npm reports success (e.g. postinstall script failed, unexpected npm layout): error with the resolved path and a suggestion to re-run `npm install -g scifi@latest` manually.
  - Shell command hashing: after global upgrade, the user's current shell may cache the old binary path. The child process is unaffected (fresh spawn resolves the new symlink). Output could suggest `hash -r` if the user encounters stale behavior, but this is a cosmetic nicety, not a requirement.
  - Concurrent upgrade: if two terminals run `scifi upgrade` simultaneously, both npm upgrades will succeed (idempotent), and both skill re-installs will write the same files (idempotent). No locking needed.
  - Empty skills catalog in new version: skill re-install installs zero skills; report reflects this honestly. Not an error.
  - Config with duplicate harness entries: deduplicate when reading, same as init does.
  - Repo with config but harness dirs manually deleted: skill re-install recreates them. Config is authoritative, not filesystem state.
  - Downgrade via `@latest`: if the resolved latest is older than the currently installed version (e.g. user had a pre-release or linked dev version), the command still proceeds but the version-change line notes the direction explicitly (e.g. "Changing scifi from 1.1.0-pre to 1.0.0 (latest stable)").
- **Open questions:** none.
