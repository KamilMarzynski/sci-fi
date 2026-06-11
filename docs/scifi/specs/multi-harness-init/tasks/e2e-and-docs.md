---
id: T7
slug: e2e-and-docs
status: done
depends-on:
  - T6
---

# Installed-build e2e for multi-harness init, and docs

## Goal

The packaged CLI is verified to install multiple harnesses in one `init`, and the
user-facing docs describe the new provider list and multi-select behavior.

## Tests first

- `tests/e2e/installed-init.test.ts` (extend): run the installed/packaged CLI
  (per `TESTING.md`'s installed-build flow) with two `--harness` flags in a temp
  project and assert both harness skill dirs exist (e.g.
  `.claude/skills/<id>/SKILL.md` and `.cursor/skills/<id>/SKILL.md`) and that
  `config.json` lists both harnesses.

## Work

- Extend the e2e installed-init test for the multi-harness path.
- Update `README` (and the init `--harness` help text if it enumerates options)
  for the four providers and repeatable multi-select; note `--yes` defaults to
  claude-code. Remove any mention of `agents-md`.
- Run the mandatory installed-build verification from `TESTING.md` for a
  multi-harness init.

## Validation

`npm run check` is green, `npm test tests/e2e/installed-init.test.ts` passes, and
the `TESTING.md` installed-build command for a multi-harness init succeeds.

## Satisfies

Spec AC: e2e installed-init covers multi-harness; docs reflect new behavior;
`npm run check` green and installed-build verified.
