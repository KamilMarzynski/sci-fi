---
id: T1
slug: checkbox-picker
status: done
depends-on: []
---

# Checkbox picker module

## Goal

Ship the deep `runCheckbox` module plus its `KeyReader`/`Key` seam,
`createStdinKeyReader`, `canEnterRawMode`, `promptHarnesses`, and
`CheckboxCancelledError` in `src/cli/prompts/checkbox.ts` — fully exercised
through a scripted reader and a capturing output stream, no real TTY. New file,
no existing call site touched.

## Tests first

`tests/cli/prompts/checkbox.test.ts`, written before implementation:

- **initial render:** with all 5 harness items, the first frame written to the
  capturing `Writable` shows every item unchecked, the cursor marker on the
  first item, and the message.
- **toggle:** scripted `['space','enter']` resolves to `['claude-code']`; the
  pre-confirm frame shows the first row checked.
- **navigation + wrap:** `['down','space','enter']` selects the 2nd id;
  `['up','space','enter']` (cursor wraps from first → last) selects the last id.
- **multi-select order:** a sequence checking rows 3 then 1 resolves to those ids
  in top-to-bottom display order (id at index 0 before id at index 2).
- **empty re-prompt:** `['enter','space','enter']` does not resolve on the first
  `enter`; a frame containing the inline "select at least one" message is
  rendered, and it finally resolves to the single checked id.
- **cancel:** scripted `['cancel']` rejects with `CheckboxCancelledError`.
- **canEnterRawMode:** fake stream `{ isTTY: true, setRawMode: () => {} }` → true;
  `{ isTTY: true }` (no `setRawMode`) and `{ isTTY: false, setRawMode: fn }` →
  false.

## Work

- Add `src/cli/prompts/checkbox.ts`:
  - `type Key = 'up' | 'down' | 'space' | 'enter' | 'cancel'`.
  - `interface KeyReader { read(): Promise<Key> }`.
  - `interface CheckboxItem { id: string; label: string }`.
  - `class CheckboxCancelledError extends Error`.
  - `runCheckbox(options: { items; message; reader: KeyReader; output: Writable }): Promise<readonly string[]>`
    — internal mutable state (cursor index, `Set<number>` checked); render frame
    to `output` (hide cursor on first paint; clear prior frame's lines via ANSI
    before each repaint); loop `reader.read()`; `up/down` move with wrap,
    `space` toggle, `enter` → if checked non-empty resolve ids in index order
    else re-render with inline message, `cancel` → throw
    `CheckboxCancelledError`. Show cursor before resolving.
  - `canEnterRawMode(input): boolean` — `Boolean(input.isTTY) && typeof
    input.setRawMode === 'function'`.
  - `createStdinKeyReader(input): KeyReader & { close(): void }` — wraps
    `readline.emitKeypressEvents` + `setRawMode(true)`; maps arrows/space/return
    and `Ctrl-C`/`Esc` → `cancel`; swallows unmapped keys; `close()` restores.
  - `promptHarnesses(choices): Promise<readonly string[]>` — build items
    (`label === id`), create reader from `process.stdin`, `try` run against
    `process.stdout`, `finally` `reader.close()`.
- No consumer changes here — `init.ts` is wired in T3. Build stays green: this
  task only adds a new file and its tests.

## Validation

`npm test tests/cli/prompts/checkbox.test.ts` green; `npm run typecheck` and
`npm run check` clean.

## Satisfies

Spec AC: initial render, space toggle, ↑/↓ wrap, enter≥1 ordered selection,
enter=0 re-prompt, cancel→throw, raw-mode predicate, scripted-reader coverage
asserting selection + frames. Design modules `runCheckbox`, `KeyReader`,
`createStdinKeyReader`, `canEnterRawMode`, `promptHarnesses`.
