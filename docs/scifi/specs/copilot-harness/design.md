# Design: Copilot installation support

- **Slug:** copilot-harness
- **Spec:** ./spec.md

## Approach

This change is data-driven and policy-driven, not structural. We add `github-copilot` as a fifth harness by extending two existing lookup tables (`HarnessId` union and `HARNESS_SPECS`), and we tighten the `--yes` contract in `resolveHarnesses` so it no longer silently defaults to `claude-code`. No new modules are introduced; all work flows through existing deep seams.

The harness adapter factory (`createSkillBundleAdapter`) already handles arbitrary `(id, baseDir)` pairs — adding `github-copilot` with base dir `.github/skills` is a one-line entry in the spec table. The install pipeline (`installSkills`, `writeSkillBundles`) is already generic across harnesses; it requires no changes.

The `--yes` behavioral change is confined to `resolveHarnesses`. Removing the `DEFAULT_HARNESS` constant and throwing `ScifiError('INVALID_ARGUMENT', ...)` when `yes` is true and flags are empty keeps the resolution logic self-contained. The `init.ts` error handler (`normalizeInitError` + `emitError`) already supports `ScifiError` passthrough, so no CLI wiring changes are needed beyond updating the `--yes` option description.

## Modules

### `src/core/skills/harness/adapter.ts` (existing, extended)
- **Responsibility:** Defines the canonical `HarnessId` union and the list of known harnesses.
- **Interface:** `HarnessId` type, `KNOWN_HARNESS_IDS` array, `isHarnessId()` guard, `InvalidHarnessError`.
- **Why deep:** A single source of truth for all harness identity logic in the system. Every consumer (CLI prompts, config, error messages) derives from this table.

### `src/core/skills/harness/other-harnesses.ts` (existing, extended)
- **Responsibility:** Declares harness specs for adapters that use the standard bundle-writer factory.
- **Interface:** `HARNESS_SPECS` table of `{ id: HarnessId, baseDir: string }`; exported `otherAdapters`.
- **Why deep:** The factory `createSkillBundleAdapter` hides all SKILL.md rendering, frontmatter generation, and asset copying. Adding a harness is a single table row.

### `src/core/init/prompt-harness.ts` (existing, behavior changed)
- **Responsibility:** Resolves which harnesses to install from CLI flags, `--yes`, or interactive prompt.
- **Interface:** `resolveHarnesses({ flags, yes, ask }) -> HarnessId[]`. Precedence: flags > yes > ask. Validation and deduplication are hidden inside.
- **Why deep:** Callers do not know about `DEFAULT_HARNESS`, deduplication order, or how `--yes` is interpreted. After this change, the function also hides the "`--yes` requires flags" policy.
- **Note on interactive default:** The empty-input fallback (`choices[0]`) is handled by `askInteractively` in `init.ts`, not by `DEFAULT_HARNESS` in `prompt-harness.ts`. Removing `DEFAULT_HARNESS` therefore does not change the interactive prompt default — that remains out of scope per the spec.

### `src/cli/commands/init.ts` (existing, description updated)
- **Responsibility:** CLI surface for `scifi init`.
- **Interface:** Commander option registration + action handler. Delegates to `resolveHarnesses`, `scaffoldInit`, `installSkills`, `writeConfig`.
- **Why deep:** All init orchestration (resolution → scaffold → install → persist → output) is hidden behind a single `registerInitCommand` call.

## Seams and data flow

```
CLI flags (--harness, --yes)
    ↓
resolveHarnesses()  ←  HarnessId[] from adapter.ts
    ↓
installSkills()  ←  adapters from registry (via other-harnesses.ts + register-defaults.ts)
    ↓
writeSkillBundles()  ←  factory hides rendering
    ↓
.<harness>/skills/<id>/SKILL.md  on disk
```

For the `--yes` change:

```
--yes with no --harness
    ↓
resolveHarnesses() throws ScifiError('INVALID_ARGUMENT', ...)
    ↓
caught by init.ts action handler
    ↓
normalizeInitError() passes ScifiError through (not an InvalidHarnessError)
    ↓
emitError() writes INVALID_ARGUMENT to stderr, sets exit code 2
```

## Architecture & context impact

- **Modules touched:**
  - `src/core/skills/harness/adapter.ts` — append `github-copilot` to union and `KNOWN_HARNESS_IDS`
  - `src/core/skills/harness/other-harnesses.ts` — add `HARNESS_SPECS` entry `{ id: 'github-copilot', baseDir: join('.github', 'skills') }`
  - `src/core/init/prompt-harness.ts` — remove `DEFAULT_HARNESS`; throw `ScifiError` when `yes && flags.length === 0`
  - `src/cli/commands/init.ts` — update `--yes` option description to clarify it requires `--harness`
  - `tests/core/init/prompt-harness.test.ts` — update expected choices array; replace `--yes` default test with error test
  - `tests/cli/init.test.ts` — rewrite the test that asserts `--yes` installs claude-code alone
  - `tests/e2e/installed-init.test.ts` — add installed-build verification for `github-copilot`
  - `docs/scifi/CONTEXT.md` — add `github-copilot` term

- **New seams introduced:** none

- **ADRs:**
  - `0002-yes-requires-explicit-harness.md` (already written during spec)

- **New CONTEXT.md terms:**
  - **github-copilot** — The GitHub Copilot AI coding assistant, treated as a Harness for scifi skill installation. Installs to `.github/skills/`.

## Acceptance criteria coverage

| Acceptance criterion | Satisfied by |
| --- | --- |
| `scifi init --harness github-copilot --yes` exits 0 and creates `.github/skills/sf-feature/SKILL.md` | Task: add-copilot-cli-test (asserts file exists) |
| `github-copilot` appears in `KNOWN_HARNESS_IDS` and the `HarnessId` union | Task: add-harness-type-and-adapter |
| `github-copilot` is registered in the adapter registry at module-load time | Task: add-harness-type-and-adapter |
| `scifi init --yes` (no `--harness`) exits with a non-zero status and stderr contains `INVALID_ARGUMENT` | Task: require-harness-with-yes |
| `scifi init --harness claude-code --harness github-copilot --yes` installs to both `.claude/skills/` and `.github/skills/` | Task: add-copilot-cli-test (multi-harness variant) |
| Config file written by `init` includes `github-copilot` in `harnesses` when selected | Task: add-copilot-cli-test |
| Interactive multi-select prompt lists `github-copilot` among choices | Task: add-harness-type-and-adapter (choices array includes it) |
| `scifi init --harness not-a-harness` exits non-zero and names the invalid identifier | Existing behavior, verified by existing tests; no change |
| Installed-build end-to-end test verifies `scifi init --harness github-copilot --yes` produces `.github/skills/sf-feature/SKILL.md` | Task: add-copilot-installed-test |
| All existing tests that relied on `--yes` defaulting to `claude-code` are updated to pass `--harness` explicitly | Task: require-harness-with-yes |
| `docs/scifi/CONTEXT.md` includes the `github-copilot` term definition | Task: update-context-glossary |
| `npm run check` passes after changes | Task: final-check |

## Edge cases & failure modes

| Edge case | Handling |
| --- | --- |
| Pre-existing `.github/` directory from other tooling | `writeSkillBundles` creates `.github/skills/` if needed; no conflict with sibling files |
| Pre-existing `.github/skills/` with non-scifi skills | Skills are written by ID into subdirectories; coexistence is fine unless IDs collide |
| `scifi init --harness github-copilot` on non-GitHub-hosted repo | No remote-origin validation; `.github/skills/` is a local directory like any other harness base dir |
| Re-init overwrites user-edited scifi skills in `.github/skills/` | Same behavior as all harnesses: scifi-owned skills are overwritten on install (documented) |
| `--yes` without `--harness` in non-interactive context | `resolveHarnesses` throws `ScifiError('INVALID_ARGUMENT', ...)` before any disk writes occur |
| `--yes` without `--harness` in interactive TTY | Same error — `--yes` is not a substitute for selection, even with a human present |

## Test strategy

- **Unit:** `prompt-harness.test.ts` verifies `resolveHarnesses` behavior for flags, `--yes`, deduplication, and the new `--yes`-without-flags error.
- **Integration (CLI):** `init.test.ts` verifies end-to-end `scifi init` with `--harness github-copilot --yes`, including file creation and config content.
- **Installed-build:** `installed-init.test.ts` verifies the packaged CLI installed into a sandbox can init with `github-copilot` and writes to `.github/skills/`.
- **No mocks needed** for filesystem behavior; tests use real temp directories.

## Open questions

- None — all items resolved.
