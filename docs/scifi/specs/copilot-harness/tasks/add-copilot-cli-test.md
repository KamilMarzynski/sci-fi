---
id: T3
slug: add-copilot-cli-test
status: done
depends-on:
  - T1
---

# Add CLI integration tests for github-copilot harness

## Goal

Verify that `scifi init --harness github-copilot --yes` installs skills to `.github/skills/` and writes the correct config.

## Tests first

Add to `tests/cli/init.test.ts`:
- A test that runs `runCli(['init', '--harness', 'github-copilot', '--yes'])` and asserts:
  - exit code 0
  - `.github/skills/sf-feature/SKILL.md` exists
  - `docs/scifi/.scifi/config.json` contains `harnesses: ['github-copilot']`
- A multi-harness variant that runs `runCli(['init', '--harness', 'claude-code', '--harness', 'github-copilot', '--yes'])` and asserts both `.claude/skills/` and `.github/skills/` exist.

## Work

1. `tests/cli/init.test.ts`:
   - Add the single-harness Copilot test.
   - Add the multi-harness Copilot + Claude Code test.
   - Use the existing `afterEach` + temp-directory pattern from the file.

**Call sites affected:** None — this is a new test that exercises existing code paths.

## Validation

```bash
npm test tests/cli/init.test.ts
```

All tests in the file must pass, including the new ones.

## Satisfies

- `scifi init --harness github-copilot --yes` exits 0 and creates `.github/skills/sf-feature/SKILL.md`
- `scifi init --harness claude-code --harness github-copilot --yes` installs to both `.claude/skills/` and `.github/skills/`
- Config file written by `init` includes `github-copilot` in `harnesses` when selected
