---
id: T6
slug: init-command-wiring
status: done
depends-on:
  - T3
  - T4
  - T5
---

# Wire the init command for multi-select and per-harness output

## Goal

`scifi init` accepts a repeatable `--harness`, drives the multi-select pipeline,
persists the array, and reports the per-harness breakdown — succeeding when ≥1
harness installed and failing when all selected harnesses failed.

## Tests first

- `tests/cli/init.test.ts` (extend, via `buildProgram().parseAsync` / `runCli`):
  - `--harness claude-code --harness cursor --yes`-style invocation installs both
    `.claude/skills` and `.cursor/skills`; `config.json` lists both.
  - `--yes` with no `--harness` installs claude-code only.
  - non-interactive with neither `--harness` nor `--yes` exits non-zero with
    `INVALID_ARGUMENT`.
  - duplicate `--harness cursor --harness cursor` installs cursor once.
  - all-selected-harnesses-fail (simulate via an unwritable target or a stubbed
    failing adapter) exits non-zero; a partial failure (one of several) exits
    zero and the output names the failed harness.
  - success output (human + `--json`) lists installed harnesses and their
    locations.

## Work

- `init.ts`: make `--harness <id>` repeatable (commander collector accumulating
  into a string array, default `[]`); option type `harness: string[]`.
- Non-interactive guard: error when `harness` array is empty, `--yes` absent,
  and `!isInteractive()`.
- Call `resolveHarnesses({ flags, yes, ask: askInteractively })`,
  `installSkills(...)`, `writeConfig({ projectRoot, harnesses })`.
- `askInteractively(choices)` parses a space/comma-separated multi-select answer
  into selected ids and re-prompts on empty input; returns `string[]`.
  Out-of-range indices map to the raw token (as today), so `resolveHarnesses`
  rejects them via `InvalidHarnessError` — keep that single validation point
  rather than validating in the picker.
- Drop the now-redundant single-harness leftovers: the
  `getAdapter(harness)` pre-check at init.ts:59-62 (every id is real now and
  `resolveHarnesses` already validates) and the scalar `harness` argument passed
  to `scaffoldInit` (it ignores it; pass `{ projectRoot }`).
- Emit: if `report.installed` empty → `emitError` (all failed, include errors);
  else `emitSuccess` with both human text and a JSON payload whose success data
  carries a `harnesses` key = `report.installed` (each `{ harness, baseDir,
  skills }`) plus any `failed` entries — replacing the old scalar `harness`
  field. T7's e2e asserts against this `harnesses` shape and `config.json`.

## Validation

`npm test tests/cli/init.test.ts`.

## Satisfies

Spec AC: repeatable `--harness`; `--yes` claude-code only; non-interactive guard;
dedup; best-effort exit semantics; `emitSuccess` lists harnesses + locations.
