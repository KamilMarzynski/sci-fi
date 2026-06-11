---
id: T2
slug: real-adapters-and-remove-agents-md
status: done
depends-on:
  - T1
---

# All four harnesses real; remove agents-md and the not-implemented machinery

## Goal

`opencode`, `codex`, and `cursor` install for real via the factory; `agents-md`
and the dead `HarnessNotImplementedError` / `'not-implemented'` machinery are
gone. Every known harness resolves to a registered adapter.

## Tests first

- `tests/core/skills/harness/registry.test.ts` (update):
  - `getAdapter('opencode'|'codex'|'cursor'|'claude-code')` each returns an
    adapter with the matching `id`.
  - `getAdapter('agents-md')` throws `InvalidHarnessError` (unknown id), not a
    not-implemented error. Remove the old `HarnessNotImplementedError` case.
- `tests/core/skills/harness/install-by-harness.test.ts` (new): installing the
  catalog through each adapter writes SKILL.md+assets under `.claude/skills`,
  `.opencode/skills`, `.codex/skills`, `.cursor/skills` respectively; the
  rendered `SKILL.md` and assets are **byte-identical** across all four dirs.
- `tests/core/init/prompt-harness.test.ts` (update): `KNOWN_HARNESS_IDS`
  equals `['claude-code','opencode','codex','cursor']`.

## Work

- `adapter.ts`: `HarnessId = 'claude-code'|'opencode'|'codex'|'cursor'`;
  `KNOWN_HARNESS_IDS` the same four; delete `HarnessNotImplementedError` and its
  `ISSUES_URL`/`package.json` plumbing if now unused.
- Add `opencode.ts`, `codex.ts`, `cursor.ts` (or a single declarative table)
  using `createSkillBundleAdapter` with base dirs `.opencode/skills`,
  `.codex/skills`, `.cursor/skills`.
- `registry.ts`: back with `Map<HarnessId, HarnessAdapter>`; drop the
  `'not-implemented'` sentinel and `RegistryEntry` union; `getAdapter` throws
  `InvalidHarnessError` for unknown strings and an internal `Error` for a
  known-but-unregistered id.
- `register-defaults.ts`: register all four adapters.
- `cli/commands/init.ts`: remove the `HarnessNotImplementedError` branch from
  `normalizeInitError` and its import.

## Validation

`npm test tests/core/skills/harness/ tests/core/init/prompt-harness.test.ts` and
`grep -rn "HarnessNotImplementedError\|not-implemented\|agents-md" src` returns
nothing.

## Satisfies

Spec AC: agents-md removal; `KNOWN_HARNESS_IDS` exactly four; error/sentinel
removal; per-harness install dirs; byte-identical across harnesses.
