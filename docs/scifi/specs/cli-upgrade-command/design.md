# Design: CLI upgrade command

- **Slug:** cli-upgrade-command
- **Spec:** ./spec.md

## Approach

Two-phase command: the parent (old binary) upgrades the global npm package, then spawns the **new** binary in an internal mode to re-install skills into the configured harnesses. The child process avoids shell PATH caching by resolving the new binary path directly from `npm prefix -g`. The command follows the existing thin-command/thick-core pattern: the CLI handler orchestrates phases and formats output; core modules handle npm spawn, version detection, config reading, and child-process coordination.

## Modules

### `src/core/init/config.ts` (modified — add `readConfig`)

- **Responsibility:** Read and validate the scifi config file from disk.
- **Interface:**
  - `Config` type: `{ version: number; harnesses: HarnessId[] }`
  - `readConfig(projectRoot: string): Promise<Config>` — reads `docs/scifi/.scifi/config.json`, validates structure, deduplicates harnesses, filters invalid harness IDs (with console warning), throws on missing/malformed/empty-after-filtering.
  - `writeConfig(options: WriteConfigOptions): Promise<void>` — unchanged.
- **Why deep:** Hides JSON parsing, schema validation, harness ID filtering, deduplication, and error message generation behind a single async call.

### `src/core/package-version.ts` (new — extracted from `src/cli/index.ts`)

- **Responsibility:** Read the scifi version from a package root's `package.json`.
- **Interface:**
  - `readPackageVersion(packageRoot: string): string` — requires and validates `package.json`, returns the `version` field.
- **Why deep:** Hides `createRequire` mechanics, validation, and error formatting. Single source of truth for version extraction used by both the CLI entry point and the upgrade command.

### `src/core/upgrade/npm.ts` (new)

- **Responsibility:** Spawn npm commands for global install and prefix resolution.
- **Interface:**
  - `NpmSpawnResult`: `{ stdout: string; stderr: string; exitCode: number }`
  - `npmGlobalInstall(packageName: string): Promise<NpmSpawnResult>` — runs `npm install -g <package>@latest`, captures output.
  - `npmGlobalPrefix(): Promise<string>` — runs `npm prefix -g`, returns trimmed stdout.
  - `resolveGlobalBinPath(prefix: string, binName: string): string` — pure function; joins prefix + platform-appropriate bin subdirectory + platform-appropriate extension (`.cmd` on Windows).
- **Why deep:** Hides spawn mechanics, platform-specific binary path resolution, error classification (permission denied vs network failure vs npm-not-found).

### `src/core/upgrade/version.ts` (new)

- **Responsibility:** Detect current and new scifi versions.
- **Interface:**
  - `readCurrentVersion(packageRoot: string): string` — delegates to `readPackageVersion`.
  - `readNewVersion(binPath: string): Promise<string>` — spawns `<binPath> --version`, parses stdout to extract the version string.
- **Why deep:** Hides version extraction from CLI `--version` output (which may include the program name), normalizes the string for comparison.

### `src/core/upgrade/child.ts` (new)

- **Responsibility:** Spawn the new binary in internal install mode and parse its report.
- **Interface:**
  - `SkillInstallArgs`: `{ binPath: string; projectRoot: string; harnesses: readonly HarnessId[] }`
  - `spawnSkillInstall(args: SkillInstallArgs): Promise<InstallReport>` — spawns `<binPath> upgrade --_install --project-root <path> --harnesses <ids>`, validates the binary exists first, parses stdout JSON into `InstallReport`, propagates child errors.
- **Why deep:** Hides spawn arguments, JSON parsing, binary-existence check, and error propagation from child process failures.

### `src/cli/commands/upgrade.ts` (new)

- **Responsibility:** Thin command handler — register the `upgrade` command, orchestrate the two phases, format output.
- **Interface:** Exports `registerUpgradeCommand(program: Command): void`. The command supports `--yes`, `--json`, and an internal `--_install` flag (hidden from help; used by the child process).
- **Why deep:** N/A — this is intentionally thin. All behavior lives in core modules. The handler only wires: read config → show versions → prompt → npm phase → child phase → emit result.

## Seams and data flow

```
User runs: scifi upgrade [--yes] [--json]

1. CLI handler (upgrade.ts)
   ├─ readConfig(cwd()) → Config { harnesses }
   ├─ readCurrentVersion(packageRoot) → "1.0.0"
   ├─ [if !--yes] prompt y/N
   ├─ npmGlobalInstall("scifi") → NpmSpawnResult
   │   └─ on failure → emitError, exit
   ├─ npmGlobalPrefix() → "/usr/local/lib/node_modules"
   ├─ resolveGlobalBinPath(prefix, "scifi") → "/usr/local/bin/scifi"
   ├─ readNewVersion(binPath) → "1.1.0"
   ├─ [if versions equal] skip npm phase marker
   └─ spawnSkillInstall({ binPath, projectRoot, harnesses })
       │
       └─ Child process (new binary):
          scifi upgrade --_install --project-root <cwd> --harnesses <ids>
          │
          ├─ findPackageRoot(import.meta.url) → new package root
          ├─ installSkills({ projectRoot, harnesses, packageRoot })
          └─ stdout: JSON InstallReport
       
   ← parent parses child stdout → InstallReport
   ← emitSuccess / emitError with combined result
```

**Key seams:**
- `readConfig` — config is the single source of truth for harness selection. Upgrade does not take `--harness` flags.
- `installSkills` (reused, unchanged) — the child process calls the same function `init` uses. No new install path.
- `emitSuccess` / `emitError` — same output pattern as `init`.
- `--_install` flag — internal seam between parent and child. Not user-facing.

## Architecture & context impact

- **Modules touched:**
  - New: `src/core/upgrade/npm.ts`, `src/core/upgrade/version.ts`, `src/core/upgrade/child.ts`
  - New: `src/core/package-version.ts` (extracted from `src/cli/index.ts`)
  - New: `src/cli/commands/upgrade.ts`
  - Modified: `src/core/init/config.ts` — add `Config` type, `readConfig()`
  - Modified: `src/cli/index.ts` — import `readPackageVersion` from new module, register upgrade command
- **New seams introduced:**
  - `readConfig` — new public function on existing config module
  - `readPackageVersion` — new shared module, replaces local function in CLI entry point
  - `npmGlobalInstall`, `npmGlobalPrefix`, `resolveGlobalBinPath` — new npm spawn seam
  - `spawnSkillInstall` — new child-process seam
  - `--_install` internal flag — parent-to-child contract
- **ADRs:** none — follows existing patterns (config as source of truth per init, per-harness install per ADR 0001, thin-command/thick-core module boundary).
- **New CONTEXT.md terms:** none — "upgrade" is a CLI command, not a domain concept.

## Acceptance criteria coverage

| Acceptance criterion | Satisfied by |
| --- | --- |
| `scifi upgrade` runs npm install -g then spawns child for skill re-install | `upgrade.ts` orchestration, `npm.ts`, `child.ts` |
| Prints version change (from → to) | `version.ts` + `upgrade.ts` human output formatting |
| `--yes` skips confirmation prompt | `upgrade.ts` prompt gating |
| `--json` outputs structured JSON with all required keys | `upgrade.ts` JSON output formatting, mapping `InstallReport` + version/npm data |
| Already at latest: skip npm, still re-install skills | `version.ts` comparison + `upgrade.ts` conditional |
| Missing config → "not initialized" error | `readConfig()` in `config.ts` |
| Malformed config → clear error message | `readConfig()` validation in `config.ts` |
| npm install -g failure → error before skill re-install | `npm.ts` error propagation + `upgrade.ts` phase gating |
| Child process failure → reported with child's error | `child.ts` error propagation |
| Invalid harnesses → skip with warning, proceed with valid | `readConfig()` filtering in `config.ts` |
| Zero valid harnesses → error | `readConfig()` empty-after-filtering check |
| `cwd()` as project root, no tree walking | `upgrade.ts` passes `cwd()` directly to `readConfig()` |
| End-to-end test verifies full flow | E2E test task |
| Installed-build verification | Installed-build verification task |

## Edge cases & failure modes

| Edge case | Handling |
| --- | --- |
| npm not installed | `npmGlobalInstall` spawn fails with ENOENT; error message includes "npm may not be available" hint |
| `npm prefix -g` fails | Treated as npm failure; error includes npm stderr |
| New binary missing after npm reports success | `spawnSkillInstall` checks `existsSync(binPath)` before spawn; `INTERNAL` error with resolved path and "re-run npm install -g manually" hint |
| Already at latest version | String equality check on normalized versions; npm phase skipped, `npmUpgraded: false` in JSON output, skill re-install proceeds |
| Invalid harness IDs in config | `readConfig` filters with `isHarnessId()`, warns via console.warn for each invalid entry, proceeds with valid ones |
| Zero valid harnesses after filtering | `readConfig` throws `INVALID_ARGUMENT` with message pointing to `scifi init` for repair |
| Empty skills catalog in new version | `installSkills` installs zero skills; report reflects honestly — not an error |
| Duplicate harness entries in config | `readConfig` deduplicates silently |
| Harness dirs manually deleted | Skill re-install recreates them; config is authoritative |
| Downgrade (newer pre-release → older stable) | Version change line notes direction explicitly |
| Concurrent upgrade (two terminals) | Both npm upgrades idempotent; both skill re-installs idempotent; no locking needed |
| Permission denied on npm install -g | Error includes hint about sudo/npm prefix |
| Child process exits non-zero | `spawnSkillInstall` wraps child stderr in `ScifiError` |
| Child produces unparseable stdout | `spawnSkillInstall` throws `INTERNAL` with raw stdout snippet |
| Non-interactive without `--yes` | Command proceeds (no prompt to block on); same as init behavior |

## Test strategy

- **Unit tests (vitest, `tests/unit/`):**
  - `config.test.ts` — `readConfig` validation: missing file, malformed JSON, missing harnesses key, non-array harnesses, non-string entries, invalid IDs (filtered), duplicates (deduped), empty after filtering.
  - `package-version.test.ts` — `readPackageVersion` with valid/missing/malformed package.json.
  - `npm.test.ts` — `npmGlobalInstall`, `npmGlobalPrefix` with mocked `child_process`; `resolveGlobalBinPath` pure function tests for Unix/Windows.
  - `version.test.ts` — `readNewVersion` parsing of `--version` output; `readCurrentVersion` delegation.
  - `child.test.ts` — `spawnSkillInstall` with mocked `child_process`: success JSON parse, missing binary, non-zero exit, unparseable stdout.

- **E2E tests (vitest, `tests/e2e/`):**
  - `installed-upgrade.test.ts` — full flow in `.testing/` sandbox: init a repo with harnesses, run `upgrade --yes --json`, verify config unchanged, verify skills re-installed, verify JSON output shape. npm phase verified with a controlled approach (mock npm script or environment that simulates the upgrade).

- **Installed-build verification:**
  - Build package, install in `.testing/` sandbox, run `scifi upgrade --yes --json`, assert output structure and file existence. npm phase: use a mock `npm` script in PATH that records invocations and returns controlled output. Skill phase: real install against temp project with real harness dirs.

## Open questions

None.
