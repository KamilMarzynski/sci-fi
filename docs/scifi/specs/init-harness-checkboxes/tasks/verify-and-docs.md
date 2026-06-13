---
id: T4
slug: verify-and-docs
status: in-progress
depends-on:
  - T3
---

# Installed-build verification and docs

## Goal

Verify the change against an installed build per `TESTING.md`, document the new
interactive UX, and confirm ADR-0003 is present.

## Tests first

- The e2e installed-init suite (`tests/e2e/installed-init.test.ts`) continues to
  pass unmodified — it exercises the unchanged `--harness` path; assert no
  regression rather than adding new assertions there.

## Work

- Run the `.testing/` installed-build flow from `TESTING.md`: install the packed
  build and run `scifi init --harness claude-code` and a multi-harness invocation
  to confirm the non-interactive paths are intact on a real installed CLI.
- **Manual interactive check** (raw mode cannot run in CI): in a real terminal
  against the installed build, run `scifi init` with no flags; confirm the
  checkbox picker renders unchecked, arrows move with wrap, space toggles, enter
  with ≥1 installs the selected harness(es), enter with 0 re-prompts, and
  `Ctrl-C`/`Esc` aborts with a restored terminal (cursor visible, no raw-mode
  residue) and non-zero exit. Record the result in the handover.
- Update `README.md` — the interactive harness-selection description (the
  "`init` prompts you to pick a harness" sentence) so it reflects the checkbox
  picker (arrow/space/enter) instead of typed numbers.
- Confirm `docs/scifi/adr/0003-hand-rolled-harness-picker.md` exists and matches
  the shipped approach.

## Validation

`npm test` and `npm run check` green; the `.testing/` installed-init commands
succeed; manual interactive run behaves as described and is recorded in handover.

## Satisfies

Spec AC: existing tests stay green, ADR recorded, installed-build verification of
user-facing CLI behavior; CLAUDE.md docs-on-public-behavior-change requirement.
