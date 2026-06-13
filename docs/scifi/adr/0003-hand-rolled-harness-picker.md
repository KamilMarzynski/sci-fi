# 0003: Hand-rolled raw-mode harness picker over a prompt library

- Status: Accepted
- Date: 2026-06-13

## Context

`scifi init` replaces its number-typing interactive harness prompt with a
checkbox picker (arrow keys, space to toggle, enter to confirm). A checkbox UI
needs raw-mode TTY input, frame redraw, and terminal restoration.

The obvious shortcut is a maintained library such as `@inquirer/checkbox`: it
ships an accessible, battle-tested multi-select. The alternative is to hand-roll
the picker on `node`'s built-in `readline` keypress events and
`stdin.setRawMode`.

The constraints in play:

- `scifi` ships an intentionally small runtime dependency tree (`commander`,
  `yaml`, `zod`). Adding `@inquirer/checkbox` pulls in its transitive tree for a
  single, low-complexity prompt.
- The existing interactive prompt already uses only `node:readline`, so the
  primitives needed (keypress events, raw mode) are in-house knowledge, not new
  ground.
- The project values maintainability and explicit module boundaries, and the
  picker's surface area is small: five fixed rows, four key actions.

## Decision

Hand-roll the picker using `node`'s built-in `readline` keypress events and
`stdin.setRawMode`, with no new runtime dependency. The picker depends on a
`KeyReader` interface for input and an injected `output` stream so its
navigation/toggle/confirm logic is unit-testable without a real TTY, with
selection-state changes driven by the injected `KeyReader` and rendered through
the injected `output` seam.

## Consequences

- The runtime dependency tree stays at three packages; no transitive prompt-library
  surface to audit or upgrade.
- We own the raw-mode lifecycle: entering raw mode, restoring the terminal
  (including on abort), hiding/showing the cursor, and clearing the previous
  frame. These must be covered by tests rather than trusted to a library.
- When raw mode is unavailable (e.g. `TERM=dumb`), the picker cannot render, so
  init fails with `INVALID_ARGUMENT` and directs the user to `--harness`; we do
  not get a library's built-in fallback for free.
- Reversal cost is bounded: the picker sits behind the `KeyReader` interface and
  the existing `ask` seam of `resolveHarnesses`, so swapping in a library later
  is localized — but it remains a deliberate, non-trivial change, which is why it
  is recorded here.
