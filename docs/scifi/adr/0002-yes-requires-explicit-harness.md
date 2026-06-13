# 0002: --yes requires explicit --harness flags

- Status: Accepted
- Date: 2026-06-12

## Context

`scifi init` supports an interactive multi-select prompt for choosing harnesses,
and a non-interactive mode via `--harness <id>` flags. The `--yes` flag was
introduced to skip the interactive prompt entirely, but it silently defaulted to
`claude-code` when no `--harness` flags were provided.

As the harness roster grew from one (`claude-code`) to five
(`claude-code`, `opencode`, `codex`, `cursor`, `github-copilot`), this silent
default became increasingly incoherent:

- A user running `--yes` in a Copilot-only or Cursor-only repository would
  unexpectedly receive `.claude/skills/`.
- The default was invisible in the CLI help text and surprising in behavior.
- It violated the principle that non-interactive automation should be explicit
  about its inputs.

## Decision

When `--yes` is provided without any `--harness` flags, `scifi init` must exit
with `INVALID_ARGUMENT` and require the user to pass at least one `--harness`
flag. There is no default harness.

The `--yes` option description is updated from "skip prompts and use defaults" to
"skip prompts (requires --harness)" to surface the tightened contract.

## Consequences

- All automated and scripted invocations of `scifi init --yes` must be updated
to include `--harness <id>`.
- The error message names the available harnesses explicitly, making the fix
obvious.
- No silent disk writes to an unselected harness directory.
- The interactive prompt still defaults to the first harness (`claude-code`) on
empty input, preserving convenience for the interactive path only.
