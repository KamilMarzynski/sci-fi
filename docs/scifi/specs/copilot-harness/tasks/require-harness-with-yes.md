---
id: T2
slug: require-harness-with-yes
status: done
depends-on: []
---

# Require explicit --harness when --yes is used

## Goal

Remove the silent `claude-code` default from `--yes`. When `--yes` is provided without any `--harness` flags, `scifi init` must error with `INVALID_ARGUMENT`.

## Tests first

- `tests/core/init/prompt-harness.test.ts` — replace the test "returns [claude-code] when yes is true and no flags" with a test that asserts `resolveHarnesses({ flags: [], yes: true, ask: ... })` rejects with `INVALID_ARGUMENT`.
- `tests/cli/init.test.ts` — rewrite the test "installs only claude-code when --yes is given with no --harness flags" to assert `runCli(['init', '--yes'])` exits non-zero with `INVALID_ARGUMENT` in stderr.

## Work

1. `src/core/init/prompt-harness.ts`:
   - Remove the `DEFAULT_HARNESS` constant.
   - Import `ScifiError` from `../output/errors.js`.
   - In `resolveHarnesses`, when `options.yes` is true and `options.flags` is empty, throw `new ScifiError('INVALID_ARGUMENT', 'At least one --harness flag is required when using --yes.', { hint: \`Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.\` })`.
2. `src/cli/commands/init.ts`:
   - Update the `--yes` option description from `"skip prompts and use defaults"` to `"skip prompts (requires --harness)"`.
3. `tests/core/init/prompt-harness.test.ts`:
   - Replace the old default-harness test with an error assertion.
4. `tests/cli/init.test.ts`:
   - Rewrite the test that previously asserted `--yes` installs claude-code alone. It must now assert non-zero exit and `INVALID_ARGUMENT` in stderr.

**Call sites affected:**
- `src/cli/commands/init.ts` — option description only; no handler logic changes because the existing catch block already handles `ScifiError` via `emitError`.
- `tests/core/init/prompt-harness.test.ts` — one test rewritten.
- `tests/cli/init.test.ts` — one test rewritten.
- `tests/e2e/installed-init.test.ts` — no changes needed; every existing `--yes` usage in this file is already paired with `--harness` flags.

**Cross-module impact of removing `DEFAULT_HARNESS`:** Verified via grep — the constant is declared `const` (not exported) in `prompt-harness.ts` and is referenced only within that same file. No other module imports or references it.

## Validation

```bash
npm test tests/core/init/prompt-harness.test.ts tests/cli/init.test.ts
```

All tests in both files must pass.

## Satisfies

- `scifi init --yes` (no `--harness`) exits with a non-zero status and stderr contains `INVALID_ARGUMENT`
- All existing tests that relied on `--yes` defaulting to `claude-code` are updated to pass `--harness` explicitly
