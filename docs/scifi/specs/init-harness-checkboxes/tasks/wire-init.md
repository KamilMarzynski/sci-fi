---
id: T3
slug: wire-init
status: done
depends-on:
  - T1
  - T2
---

# Wire picker into init, delete number parser

## Goal

Replace the deleted number-parsing prompt with the checkbox picker in
`init.ts`, add the raw-mode-capability guard, and map a cancelled picker to
`CANCELLED` — keeping all existing init behavior identical.

## Tests first

`tests/cli/init.test.ts` (extend):

- **raw-mode-unavailable guard:** when selection would go interactive (no
  `--harness`, no `--yes`) but raw mode is unavailable, init exits with
  `INVALID_ARGUMENT` and stderr mentions `--harness`; no `docs/scifi` scaffold is
  written.
  - **Determinism mechanism (pinned):** the command reads capability from the
    process streams directly — there is no injected predicate and no options
    seam. The test makes `isInteractive()` return true *and* `canEnterRawMode`
    return false simultaneously by overriding three properties on the real
    process streams and restoring them in `afterEach`: set
    `process.stdin.isTTY = true` and `process.stdout.isTTY = true` (so
    `isInteractive()` — `stdout.isTTY && stdin.isTTY` — is true), and set
    `process.stdin.setRawMode = undefined` (so `canEnterRawMode` is false). The
    guard throws before `scaffoldInit`, so no other TTY code runs. Save the
    originals and restore them after the test. (No `vi.mock` of the tty module is
    needed; this is plain property override on `process.stdin`/`process.stdout`.)
- **existing cases stay green unmodified:** `--harness` repeat, `--yes` without
  flags → `INVALID_ARGUMENT`, non-interactive-no-flags → `INVALID_ARGUMENT`,
  unknown harness, multi-harness config — all unchanged.

`tests/cli/init.test.ts` (cancel mapping, unit):
- Export `normalizeInitError` from `init.ts` (it is currently file-private; a
  named export is justified to test the mapping directly) and assert
  `normalizeInitError(new CheckboxCancelledError())` returns a `ScifiError` with
  code `CANCELLED` and message `'Harness selection cancelled.'`.

## Work

- In `src/cli/commands/init.ts`:
  - Delete `askInteractively` (the number parser) entirely.
  - Import `promptHarnesses`, `canEnterRawMode`, `CheckboxCancelledError` from
    `../prompts/checkbox.js`.
  - Pass `ask: promptHarnesses` to `resolveHarnesses`.
  - Restructure the pre-picker guard so both checks live in one
    "selection would go interactive" branch (no `--harness`, not `--yes`):
    first `if (!isInteractive()) throw` the existing non-interactive
    `INVALID_ARGUMENT`; then `if (!canEnterRawMode(process.stdin)) throw` a new
    `INVALID_ARGUMENT` with the same hint shape (`Available harnesses: …`, pass
    `--harness <id>`). Both run before `scaffoldInit`. The command reads
    capability straight from `process.stdin` — no injected predicate.
  - Extend `normalizeInitError` to map `CheckboxCancelledError` →
    `ScifiError('CANCELLED', 'Harness selection cancelled.')`, and add a named
    `export` to it so the cancel-mapping unit test can assert it directly.
- **Call sites broken:** `askInteractively` has exactly one consumer —
  `init.ts:60` (`ask: askInteractively`), migrated within this same task. The
  `resolveHarnesses` / `ask` signature is unchanged, so `prompt-harness.ts` and
  its tests are untouched. No other consumer exists (verified by grep:
  `askInteractively` appears only in `init.ts`). Build stays green.

## Validation

`npm test tests/cli/init.test.ts tests/core/init/prompt-harness.test.ts` green;
`npm run check` clean; `npm run build` succeeds.

## Satisfies

Spec AC: enter→ids via ask end-to-end, abort→exit non-zero no scaffold, raw-mode
guard, existing tests stay green. Design `init.ts` change + `promptHarnesses`
wiring.
