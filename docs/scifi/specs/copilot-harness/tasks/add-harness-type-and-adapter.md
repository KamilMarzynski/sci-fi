---
id: T1
slug: add-harness-type-and-adapter
status: done
depends-on: []
---

# Add github-copilot harness type and adapter registration

## Goal

Register `github-copilot` as a valid harness with base directory `.github/skills`, so the adapter registry and all harness-resolution logic recognize it.

## Tests first

- `tests/core/init/prompt-harness.test.ts` — the test "calls ask with all known harness ids" currently asserts `['claude-code', 'opencode', 'codex', 'cursor']`. Update it to expect `['claude-code', 'opencode', 'codex', 'cursor', 'github-copilot']`.

## Work

1. `src/core/skills/harness/adapter.ts`:
   - Add `'github-copilot'` to the `HarnessId` union.
   - Append `'github-copilot'` to `KNOWN_HARNESS_IDS` after existing entries so `claude-code` remains first.
2. `src/core/skills/harness/other-harnesses.ts`:
   - Add `{ id: 'github-copilot', baseDir: join('.github', 'skills') }` to `HARNESS_SPECS`.
3. `tests/core/init/prompt-harness.test.ts`:
   - Update the expected choices array to include `'github-copilot'`.

**Call sites affected:** `prompt-harness.test.ts` only. All other consumers of `HarnessId` and `KNOWN_HARNESS_IDS` (config, install-skills, CLI init) handle union extension without code changes.

## Validation

```bash
npm test tests/core/init/prompt-harness.test.ts
```

All tests in that file must pass.

## Satisfies

- `github-copilot` appears in `KNOWN_HARNESS_IDS` and the `HarnessId` union
- `github-copilot` is registered in the adapter registry at module-load time
- Interactive multi-select prompt lists `github-copilot` among choices
