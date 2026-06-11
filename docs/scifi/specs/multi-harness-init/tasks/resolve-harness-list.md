---
id: T3
slug: resolve-harness-list
status: done
depends-on:
  - T2
---

# Resolve a deduped harness list from flags / --yes / picker

## Goal

`resolveHarnesses` turns flag values, `--yes`, or an interactive multi-select
into a validated, de-duplicated, non-empty `HarnessId[]`.

## Tests first

- `tests/core/init/prompt-harness.test.ts` (extend):
  - flags `['cursor','claude-code','cursor']` → `['cursor','claude-code']`
    (dedup, first-seen order).
  - an unknown flag value → throws `InvalidHarnessError`.
  - `yes: true` → `['claude-code']` (ignores `ask`).
  - no flags, not yes → calls `ask` and returns its (validated, deduped)
    multi-selection.
  - `ask` returning an empty list → rejects (selection required).

## Work

- `prompt-harness.ts`: replace `resolveHarness` with
  `resolveHarnesses({ flags: readonly string[]; yes: boolean; ask: HarnessAsk })
  : Promise<readonly HarnessId[]>`.
- `HarnessAsk = (choices: readonly HarnessId[]) => Promise<readonly string[]>`.
- Precedence: non-empty `flags` → validate+dedupe; else `yes` →
  `['claude-code']`; else `ask` → validate+dedupe, reject empty.
- Add a small dedupe-preserving-order helper (local to this module).

## Validation

`npm test tests/core/init/prompt-harness.test.ts` — all cases pass.

## Satisfies

Spec AC: repeatable/deduped `--harness`; unknown → error; interactive multi +
empty rejection; `--yes` → claude-code; config order (first-seen).
