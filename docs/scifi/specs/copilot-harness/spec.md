# Spec: Copilot installation support

- **Slug:** copilot-harness

## Problem / Why

GitHub Copilot is a widely-used AI coding assistant with CLI and IDE support for agent skills. Users of scifi who work in Copilot-enabled repositories want the same `sf-*` skill installation that Claude Code, OpenCode, Codex, and Cursor already receive. Without Copilot support, these users must manually copy skills into `.github/skills/`, which is error-prone and breaks the "single init, all harnesses" promise of `scifi init`.

Adding Copilot also surfaces a long-standing inconsistency: `--yes` silently defaults to `claude-code` only, which becomes harder to justify as the harness roster grows. This spec includes fixing that default behavior so it is coherent across all harnesses.

## Scope

### In scope

- Add `github-copilot` as a supported harness identifier.
- Install scifi skills to `.github/skills/` (project-level, following Copilot's documented layout).
- Update `HarnessId` union and `KNOWN_HARNESS_IDS` to include `github-copilot`.
- Add `github-copilot` harness adapter registration (via the existing `createSkillBundleAdapter` factory).
- Change `--yes` behavior: when `--yes` is provided with no `--harness` flags, error with `INVALID_ARGUMENT` instead of defaulting to `claude-code`.
- Update all affected tests to match the new `--yes` contract.
- Add end-to-end and installed-build verification that `scifi init --harness github-copilot --yes` produces `.github/skills/sf-feature/SKILL.md`.

### Out of scope (non-goals)

- Personal/global Copilot install to `~/.copilot/skills/` (project-level only).
- Detecting or warning about pre-existing non-scifi skills in `.github/skills/`.
- Changing the interactive prompt default (still defaults to first harness on empty input).
- Adding any Copilot-specific skill content or metadata.

## Acceptance criteria

- [ ] `scifi init --harness github-copilot --yes` exits 0 and creates `.github/skills/sf-feature/SKILL.md`.
- [ ] `github-copilot` appears in `KNOWN_HARNESS_IDS` and the `HarnessId` union.
- [ ] `github-copilot` is registered in the adapter registry at module-load time.
- [ ] `scifi init --yes` (no `--harness`) exits with a non-zero status and stderr contains `INVALID_ARGUMENT`.
- [ ] `scifi init --harness claude-code --harness github-copilot --yes` installs to both `.claude/skills/` and `.github/skills/`.
- [ ] Config file written by `init` includes `github-copilot` in `harnesses` when selected.
- [ ] Interactive multi-select prompt lists `github-copilot` among choices.
- [ ] `scifi init --harness not-a-harness` exits non-zero and the error message names the invalid identifier `not-a-harness` (it does not suggest or default to any valid harness name).
- [ ] Installed-build end-to-end test verifies `scifi init --harness github-copilot --yes` produces `.github/skills/sf-feature/SKILL.md`.
- [ ] All existing tests that relied on `--yes` defaulting to `claude-code` are updated to pass `--harness` explicitly.
- [ ] `docs/scifi/CONTEXT.md` includes the `github-copilot` term definition under the Terms section.
- [ ] `npm run check` passes after changes.

## Architecture & Context impact

- **Modules touched:**
  - `src/core/skills/harness/adapter.ts` — add `github-copilot` to union and append to `KNOWN_HARNESS_IDS` after existing entries so `claude-code` remains first
  - `src/core/skills/harness/other-harnesses.ts` — add `HARNESS_SPECS` entry for `github-copilot`
  - `src/core/init/prompt-harness.ts` — remove `DEFAULT_HARNESS` constant; make `--yes` with empty flags throw
  - `src/cli/commands/init.ts` — update `--yes` option description
  - `tests/core/init/prompt-harness.test.ts` — replace "returns [claude-code] when yes" test with "errors when yes without flags" test
  - `tests/cli/init.test.ts` — update test that asserts `--yes` installs claude-code alone; add `--harness` to all affected test calls
  - `tests/e2e/installed-init.test.ts` — add installed-build verification for `github-copilot`

- **New CONTEXT.md terms:**
  - **github-copilot** — The GitHub Copilot AI coding assistant, treated as a Harness for scifi skill installation. Installs to `.github/skills/`.

- **ADRs:**
  - `0002-yes-requires-explicit-harness.md` — records the decision to make `--yes` require explicit `--harness` flags.

## Edge cases & open questions

- **Edge cases:**
  - A pre-existing `.github/` directory from other GitHub tooling (Actions, issue templates) already exists — install appends skills alongside them, no conflict.
  - A pre-existing `.github/skills/` directory with non-scifi skills — scifi skills are written by ID, so `sf-feature` will coexist; no collision unless a non-scifi skill happens to use the same ID.
  - `scifi init --harness github-copilot` on a non-GitHub repository — Copilot's skill directory is project-level and does not require the repo to be hosted on GitHub; no validation of remote origin is performed.
  - Re-init with `--harness github-copilot` — existing scifi skills in `.github/skills/` are overwritten (same behavior as all other harnesses).

- **Open questions:**
  - None — all items resolved.
