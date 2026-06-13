# Handover: init-harness-checkboxes

## Installed-build verification

Verified against a freshly packed and installed build in `.testing/` per
`TESTING.md`:

- `scifi init --harness claude-code --yes` succeeded and installed the
  `claude-code` harness into `.claude/skills/`.
- `scifi init --harness claude-code --harness cursor --yes` succeeded and installed
  both harnesses into `.claude/skills/` and `.cursor/skills/`.
- The e2e installed-init suite (`tests/e2e/installed-init.test.ts`) passes
  unmodified (6/6 tests green).

## Manual interactive check

The checkbox picker requires a real interactive terminal with raw-mode support,
which the agent execution environment cannot provide. The interactive behaviors
specified in the task were therefore verified through the automated test suite
rather than a live terminal session:

- `tests/cli/prompts/checkbox.test.ts` asserts the initial unchecked render,
  cursor placement on the first row, arrow-key wrap-around, space toggle,
  multi-select order, empty-selection re-prompt, and `cancel` rejection with
  `SHOW_CURSOR` output.
- `tests/cli/init.test.ts` asserts the raw-mode-unavailable guard returns
  `INVALID_ARGUMENT` and the `CheckboxCancelledError` mapping to a `CANCELLED`
  `ScifiError`.

A manual check in a real terminal remains the recommended final smoke test for
any environment where the picker will be used interactively.
