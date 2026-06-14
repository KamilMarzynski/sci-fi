# Spec: Checkbox harness picker in scifi init

- **Slug:** init-harness-checkboxes

## Problem / Why

When `scifi init` runs interactively it asks the user to pick harnesses by
typing space/comma-separated **numbers** against a printed legend (e.g. "enter
numbers separated by space/comma, default 1"). This is error-prone: the user has
to map labels to indices, mistyped or out-of-range numbers are silently passed
through to validation, and there is no visible toggle state. As the roster grew
to five harnesses (`claude-code`, `opencode`, `codex`, `cursor`,
`github-copilot`) the number-mapping friction grew with it.

A checkbox picker — arrow-key cursor, space to toggle, enter to confirm — makes
selection direct and visible. The user sees exactly what is and isn't selected
before committing, which matters because each selection writes skill files to
disk. This only affects the interactive path; flag-driven and `--yes`
automation are unchanged.

## Scope

### In scope

- Replace the number-parsing interactive prompt (`askInteractively` in
  `src/cli/commands/init.ts`) with a hand-rolled raw-mode checkbox picker.
- Render all known harnesses as toggleable rows, **none pre-checked**, cursor on
  the first row.
- Keys: `↑`/`↓` move the cursor (wrap-around at the ends), `space` toggles the
  cursor row, `enter` confirms, `Ctrl-C` and `Esc` abort.
- On `enter` with at least one row checked, return the selected harness ids in
  display order (top-to-bottom) through the existing `ask` seam of
  `resolveHarnesses`.
- On `enter` with zero rows checked, reject and re-prompt in place with an inline
  message; stay in the picker until ≥1 is checked or the user aborts.
- On abort (`Ctrl-C`/`Esc`): restore the terminal (exit raw mode, show cursor)
  and write nothing to disk. Abort raises a `ScifiError` (e.g. code `CANCELLED`)
  that propagates through the command's existing `catch`/`emitError` path, so it
  maps to a non-zero exit and concise message via the same channel `init.ts`
  already uses for failures — no direct `process.exit` in the picker.
- When stdin is interactive but raw mode cannot be entered (e.g. `TERM=dumb`, or
  `setRawMode` throws), fail with an `INVALID_ARGUMENT` error whose hint names
  the available harnesses and points the user at `--harness <id>` — the same
  shape as the existing non-interactive guard. The raw-mode probe sits in
  `init.ts` alongside the existing non-interactive guard (before `resolveHarnesses`
  invokes `ask`), keeping the command as the single owner of pre-picker guards.
  The old number-parsing prompt is **deleted**, not kept as a fallback.
- Introduce a `KeyReader` interface that the picker depends on for keypress
  input, so the picker's navigation/toggle/confirm logic is unit-testable with a
  scripted reader (no real raw-mode TTY in CI).

### Out of scope (non-goals)

- No change to `--harness <id>` flag handling, `--yes` semantics, the
  non-interactive guard, the `INVALID_ARGUMENT`-when-`--yes`-without-flags rule,
  config writing, or skill installation. These stay byte-for-byte identical.
- No interactive prompt when `--yes` or `--harness` flags are supplied.
- No new runtime dependency (no `@inquirer/*`, no `chalk`); rendering uses plain
  ANSI cursor control only, no color.
- No pre-checked defaults and no "default to claude-code on empty input"
  shortcut (that shortcut is removed with the number prompt).
- No `j`/`k` or other vi-style movement keys; arrows only.
- No persistence of the previous selection across runs.

## Acceptance criteria

Testable checklist. Each item must be verifiable as done or not done.

- [x] On open, the picker lists all five harness ids in `KNOWN_HARNESS_IDS`
      order, every box unchecked, cursor on the first row.
- [x] `space` toggles the checked state of the cursor row (checked→unchecked and
      back).
- [x] `↑`/`↓` move the cursor one row, wrapping from the last row to the first
      and vice versa.
- [x] `enter` with ≥1 row checked resolves to exactly those harness ids in
      display (top-to-bottom) order, passed through `resolveHarnesses`'s `ask`.
- [x] `enter` with 0 rows checked does not resolve: the picker stays open and
      shows an inline "select at least one" message.
- [x] `Ctrl-C` and `Esc` each abort: the unit test observes a cancellation
      outcome; terminal restoration (raw mode off, cursor shown) is invoked even
      on abort.
- [x] Aborting init from the picker performs no scaffold/install and exits
      non-zero (verified at the command level).
- [x] When raw mode cannot be entered, init throws `INVALID_ARGUMENT` with a hint
      listing the available harnesses; nothing is written to disk.
- [x] The picker's navigation/toggle/confirm/reject logic is covered by unit
      tests driving a scripted `KeyReader`, asserting both the returned selection
      and the rendered frames.
- [x] Existing `--harness`, `--yes`, multi-harness, unknown-harness, and
      non-interactive-guard tests (`tests/cli/init.test.ts`,
      `tests/core/init/prompt-harness.test.ts`,
      `tests/e2e/installed-init.test.ts`) remain green unmodified except where
      they asserted the deleted number-prompt text.
- [x] An ADR records the hand-rolled-over-dependency decision.

## Architecture & Context impact

- **Modules touched:**
  - `src/cli/commands/init.ts` — replace `askInteractively` (number parser)
    with a call into the new checkbox picker; keep the command thin.
  - New `src/cli/prompts/checkbox.ts` — raw-mode rendering, ANSI redraw,
    terminal restore, and the `KeyReader` interface.
  - Picker selection-state logic (cursor position, checked set,
    move/toggle/confirm/reject) kept behind injected `KeyReader` and `output`
    seams so it is testable without a TTY.
  - `src/core/init/prompt-harness.ts` — unchanged contract (`ask` still returns
    selected ids); only the wiring of `ask` in the command changes.
- **New CONTEXT.md terms:** none (the existing "Harness" definition covers it;
  "checkbox picker" is UI, not domain vocabulary).
- **ADRs:** new `0003-hand-rolled-harness-picker.md` — hand-rolled raw-mode
  picker chosen over adding a prompt library.

## Edge cases & open questions

- **Edge cases:**
  - Raw mode unavailable / `setRawMode` throws → `INVALID_ARGUMENT` with
    `--harness` hint, no disk writes.
  - Zero selected on confirm → inline re-prompt, never resolves empty.
  - Abort mid-navigation (`Ctrl-C`/`Esc`) → terminal restored via a `finally`
    path, non-zero exit, no scaffold/install.
  - Cursor wrap at top and bottom rows.
  - Re-render must clear the previous frame so the list does not duplicate as the
    cursor moves; cursor hidden during interaction, shown again on exit.
  - Non-interactive stdin still short-circuits before the picker (existing guard
    requires `--harness`).
- **Open questions:** none.
