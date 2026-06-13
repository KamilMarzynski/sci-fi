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

## Interactive `scifi init` verification

Ran `scifi init` with no flags against the installed build under an
`expect`-driven pseudo-terminal. The picker rendered with all harnesses unchecked
and the cursor on the first row, and the following sequences completed with the
expected result:

- **Select first harness:** `space` toggled `claude-code`, `enter` confirmed,
  exit code 0, config recorded `claude-code`.
- **Arrow wrap-around:** `up` from the first row moved the cursor to the last row
  (`github-copilot`), `space` toggled it, `enter` confirmed, exit code 0, config
  recorded `github-copilot` only.
- **Multi-select:** `space` on `claude-code`, `down`, `space` on `opencode`,
  `enter` confirmed, exit code 0, config recorded both `claude-code` and
  `opencode`.
- **Empty confirm re-prompts:** `enter` with no selection showed
  `Please select at least one harness.`, then `space` + `enter` confirmed
  `claude-code`, exit code 0.
- **Abort with `Ctrl-C`:** `Ctrl-C` aborted, exit code non-zero, no config or
  `.claude` directory was written, and the terminal emitted the cursor-show
  sequence (`\x1b[?25h`).
- **Abort with `Esc`:** `Esc` aborted, exit code non-zero, no config or
  `.claude` directory was written, and the terminal emitted the cursor-show
  sequence (`\x1b[?25h`).

The terminal was restored after every run: the final output contained the
`SHOW_CURSOR` ANSI sequence (`\x1b[?25h`) and no raw-mode residue was left in the
output stream.
