# Design: Checkbox harness picker in scifi init

- **Slug:** init-harness-checkboxes
- **Spec:** ./spec.md

## Approach

The interactive harness selection moves from a number-typing readline prompt to
a raw-mode checkbox picker. The whole picker is **one deep module** —
`runCheckbox` in `src/cli/prompts/checkbox.ts` — whose narrow interface is
`(items, message, reader, output) → selected ids`, and which hides everything
behind it: cursor/checked state, the render-and-redraw loop, the "at least one"
re-prompt rule, and ordered-selection extraction. Raw-mode TTY input is isolated
behind a `KeyReader` seam so the picker's behavior is driven by normalized
`Key` events rather than raw byte sequences; tests feed a scripted reader and a
capturing output stream and assert both the returned selection and the rendered
frames, with no real TTY in CI.

The command stays thin. `init.ts` keeps owning the pre-picker guards: the
existing non-interactive guard, plus a new raw-mode-capability guard that fails
fast with `INVALID_ARGUMENT` when the picker cannot render. The
`resolveHarnesses` contract (precedence `flags > yes > ask`, `ask(choices) →
string[]`) is untouched; only the `ask` implementation passed in by `init.ts`
changes from the deleted number parser to a thin wrapper that wires the real
stdin reader and `process.stdout` into `runCheckbox`. Cancellation surfaces as a
dedicated `CheckboxCancelledError` that `init.ts` translates — exactly like it
already translates `InvalidHarnessError` — into a new `CANCELLED` `ScifiError`
that the existing `emitError` path maps to a non-zero exit.

## Modules

### `runCheckbox` (new — `src/cli/prompts/checkbox.ts`)

- **Responsibility:** Run an interactive multi-select over a fixed list of
  labelled items and return the ids the user confirmed, in display order.
- **Interface:**
  `runCheckbox(options: { items: readonly CheckboxItem[]; message: string; reader: KeyReader; output: Writable }): Promise<readonly string[]>`
  where `CheckboxItem = { id: string; label: string }`.
  - Opens with every item unchecked and the cursor on the first item.
  - Consumes `Key` events from `reader` until a terminal event:
    - `enter` with ≥1 checked → resolves with checked ids in top-to-bottom order.
    - `enter` with 0 checked → does not resolve; redraws with an inline
      "select at least one" message and keeps reading.
    - `cancel` → rejects with `CheckboxCancelledError`.
  - `up`/`down` move the cursor with wrap-around; `space` toggles the cursor row.
  - Writes frames to `output`; never reads or writes process streams directly.
  - Does **not** manage raw mode or terminal restore — that is the reader's and
    the caller's job (see seams).
- **Why deep:** A four-field interface hides the full interactive model —
  mutable cursor/checked state, the redraw protocol (clear previous frame, paint
  new one), wrap-around navigation, the empty-selection re-prompt invariant, and
  ordered extraction. Deleting it would scatter all of that into the command and
  the key handler.

### `KeyReader` + `Key` (new seam — `src/cli/prompts/checkbox.ts`)

- **Responsibility:** Supply normalized key events to the picker, decoupling it
  from raw stdin/byte handling.
- **Interface:** `interface KeyReader { read(): Promise<Key> }` where
  `Key = 'up' | 'down' | 'space' | 'enter' | 'cancel'`. `read()` resolves once
  per meaningful keypress; unmapped keys are swallowed by the implementation so
  the picker only ever sees the five events.
- **Why deep:** The real implementation hides node's `readline` keypress wiring,
  raw-mode lifecycle, and the mapping of arrow escape sequences / `Ctrl-C` /
  `Esc` into the five-symbol vocabulary; the picker is written once against that
  vocabulary and never sees a control byte.

### `createStdinKeyReader` (new — `src/cli/prompts/checkbox.ts`)

- **Responsibility:** Produce a `KeyReader` backed by a real TTY input stream,
  owning its raw-mode lifecycle.
- **Interface:**
  `createStdinKeyReader(input: tty.ReadStream): KeyReader & { close(): void }`.
  Construction calls `emitKeypressEvents(input)` and `input.setRawMode(true)`;
  `close()` calls `setRawMode(false)`, removes listeners, and pauses the stream.
  Maps `up`/`down` arrows, `space`, `return`/`enter`, and both `Ctrl-C` and
  `Esc` → `cancel`.
- **Why deep:** Concentrates every raw-mode side effect (the part that cannot run
  in CI) in one place with a `close()` the caller can always run in `finally`.

### `canEnterRawMode` (new — `src/cli/prompts/checkbox.ts`)

- **Responsibility:** Predicate for whether the picker can run on a given input.
- **Interface:** `canEnterRawMode(input: NodeJS.ReadStream): boolean` — true when
  the stream is a TTY exposing a callable `setRawMode`.
- **Why deep:** Single source of truth for the capability the `init` guard tests,
  unit-testable with a fake stream (no TTY needed).

### `promptHarnesses` (new — `src/cli/prompts/checkbox.ts`)

- **Responsibility:** The `ask` adapter — wire the real reader and stdout into
  `runCheckbox` and guarantee terminal restore.
- **Interface:** `promptHarnesses(choices: readonly HarnessId[]): Promise<readonly string[]>`
  (the `HarnessMultiAsk` shape). Builds `CheckboxItem`s from the ids, creates a
  stdin reader, runs the picker against `process.stdout`, and calls
  `reader.close()` in `finally` (so abort restores the terminal too).
- **Why deep:** Hides the reader/stdout lifecycle so `init.ts` passes a single
  function as `ask` and owns no raw-mode plumbing.

### `init.ts` (changed) and `errors.ts` (changed)

- `init.ts`: delete `askInteractively`; pass `promptHarnesses` as `ask`; add the
  raw-mode-capability guard alongside the non-interactive guard; extend
  `normalizeInitError` to map `CheckboxCancelledError → ScifiError('CANCELLED',
  'Harness selection cancelled.')`.
- `errors.ts`: add `CANCELLED` to `ErrorCode` and `EXIT_CODES` (exit 130).

## Seams and data flow

```
init.ts action
  ├─ guard: non-interactive (existing) ── INVALID_ARGUMENT if no flags/--yes
  ├─ guard: !canEnterRawMode(stdin) ───── INVALID_ARGUMENT (hint: --harness) [interactive, no flags]
  └─ resolveHarnesses({ flags, yes, ask: promptHarnesses })   [unchanged contract]
         └─ ask = promptHarnesses(choices)
              ├─ reader = createStdinKeyReader(process.stdin)   ── owns raw mode
              ├─ try: runCheckbox({ items, message, reader, output: process.stdout })
              │        └─ loop: reader.read() → Key → mutate state → render(output)
              │             ├─ enter≥1 → resolve string[]  (display order)
              │             ├─ enter=0 → re-render + keep reading
              │             └─ cancel  → throw CheckboxCancelledError
              └─ finally: reader.close()   ── setRawMode(false), restore terminal
         (CheckboxCancelledError propagates → init catch → normalizeInitError → ScifiError('CANCELLED') → emitError → exit 130)
```

Two seams cross module boundaries: **`KeyReader`** (input — real stdin reader vs
scripted test reader) and **`output: Writable`** (real `process.stdout` vs
capturing test stream). Both let `runCheckbox` be exercised end-to-end without a
TTY. The `ask` seam of `resolveHarnesses` is reused unchanged.

## Architecture & context impact

- **Modules touched:** `src/cli/commands/init.ts` (delete number parser, wire
  `promptHarnesses`, add raw-mode guard + error mapping);
  `src/core/output/errors.ts` (add `CANCELLED` code); `README.md` (the
  interactive harness-selection description → checkbox UX).
- **New seams introduced:** `KeyReader`/`Key` (input vocabulary) and the
  `output: Writable` injection on `runCheckbox`.
- **ADRs:** `0003-hand-rolled-harness-picker.md` (already written in
  `sf-feature`) governs the hand-rolled-over-library decision. No new ADR — the
  `KeyReader`/output seams are implementation detail of that decision.
- **New CONTEXT.md terms:** none. The existing "Harness" definition covers the
  domain; "checkbox picker" is UI, not domain vocabulary.

## Acceptance criteria coverage

| Acceptance criterion | Satisfied by |
| --- | --- |
| Open lists all 5 ids in `KNOWN_HARNESS_IDS` order, unchecked, cursor on first | `runCheckbox` initial render — T1 |
| `space` toggles cursor row | `runCheckbox` toggle — T1 |
| `↑`/`↓` move with wrap-around | `runCheckbox` navigation — T1 |
| `enter` ≥1 checked → those ids in display order via `ask` | `runCheckbox` confirm + `promptHarnesses` + `resolveHarnesses` — T1, T3 |
| `enter` 0 checked → stays open, inline message | `runCheckbox` re-prompt — T1 |
| `Ctrl-C` and `Esc` each abort; terminal restored even on abort | `createStdinKeyReader` cancel mapping + `promptHarnesses` finally; `CheckboxCancelledError` — T1 (cancel→throw), T3 (mapping + restore) |
| Aborting init performs no scaffold/install, exits non-zero | `normalizeInitError`→`CANCELLED`(exit 130), guard ordering before `scaffoldInit` — T2, T3 |
| Raw mode unavailable → `INVALID_ARGUMENT` with harness hint, nothing written | `canEnterRawMode` + init guard — T1 (predicate), T3 (guard) |
| Navigation/toggle/confirm/reject covered by scripted `KeyReader`, asserting selection + frames | T1 test suite |
| Existing `--harness`/`--yes`/multi/unknown/non-interactive tests stay green | No contract change; verified — T3, T4 |
| ADR records hand-rolled decision | ADR-0003 (done) — verified T4 |

## Edge cases & failure modes

- **Raw mode unavailable while interactive:** `canEnterRawMode` false → init
  throws `INVALID_ARGUMENT` (hint names harnesses + `--harness`) before any
  scaffold. Caught by unit test on the predicate (fake stream without
  `setRawMode`).
- **Empty confirm:** `runCheckbox` never resolves with `[]`; it re-renders with
  the inline message and keeps reading.
- **Abort mid-navigation:** `reader.read()` yields `cancel` → `runCheckbox`
  throws `CheckboxCancelledError`; `promptHarnesses`'s `finally` runs
  `reader.close()` (raw mode off, cursor shown) regardless; init maps to
  `CANCELLED` (exit 130), no scaffold/install.
- **Cursor wrap:** up on first row → last; down on last row → first.
- **Frame redraw:** each render clears the previous frame's lines before
  painting so the list does not duplicate as the cursor moves; cursor hidden on
  entry, shown on exit/abort.
- **Non-interactive stdin:** existing guard fires first (requires `--harness`),
  so the picker is never reached.
- **Unmapped keys:** swallowed by `createStdinKeyReader`; `runCheckbox` only ever
  sees the five `Key` values.

## Test strategy

- **Unit (the bulk) — `tests/cli/prompts/checkbox.test.ts`:** drive
  `runCheckbox` with a scripted `KeyReader` (a fixed queue of `Key`s) and a
  capturing `Writable`. Assert returned selection for sequences (toggle, move +
  wrap, multi-select order, empty-then-toggle-then-confirm) and assert rendered
  frames (initial unchecked state, checkbox glyphs, cursor marker, inline
  empty-selection message). Assert `cancel` rejects with
  `CheckboxCancelledError`. Test `canEnterRawMode` with fake streams (TTY+fn →
  true; missing `setRawMode` / non-TTY → false).
- **Unit — `tests/core/output/errors.test.ts`:** `CANCELLED` maps to exit code
  130. (Extend existing error tests.)
- **CLI — `tests/cli/init.test.ts`:** keep existing flag/`--yes`/non-interactive
  cases green (they never enter the picker). Add a case asserting the
  raw-mode-unavailable guard path returns `INVALID_ARGUMENT` mentioning
  `--harness` when forced (inject/fake capability). The cancel→exit-130 mapping
  is unit-covered via `normalizeInitError`.
- **Raw-mode lifecycle (`createStdinKeyReader`):** the one part that needs a real
  TTY is not unit-tested in CI; it is verified via the installed-build /
  `.testing/` flow per `TESTING.md` and a documented manual interactive check in
  the handover (T4). The e2e installed-init suite continues to exercise the
  `--harness` path, which is unchanged.

## Open questions

None.
