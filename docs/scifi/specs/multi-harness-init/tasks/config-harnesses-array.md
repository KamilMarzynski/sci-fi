---
id: T4
slug: config-harnesses-array
status: done
depends-on:
  - T2
---

# Persist harnesses as an array in config.json

## Goal

`writeConfig` records the selected harness list as
`{ "version": 1, "harnesses": [...] }`.

## Tests first

- `tests/core/init/config.test.ts` (update):
  - `writeConfig({ projectRoot, harnesses: ['claude-code','cursor'] })` writes
    `{ version: 1, harnesses: ['claude-code','cursor'] }` to
    `docs/scifi/.scifi/config.json`.
  - Existing `config.json` is left untouched (`wx` no-op).

## Work

- `config.ts`: change `WriteConfigOptions.harness: HarnessId` to
  `harnesses: readonly HarnessId[]`; serialize `{ version: 1, harnesses }`.
  Keep the `EEXIST` no-op behavior.

## Validation

`npm test tests/core/init/config.test.ts`.

## Satisfies

Spec AC: `config.json` is `{version:1, harnesses:[...]}` deduped in first-seen
order (order comes from T3; this task persists it).
