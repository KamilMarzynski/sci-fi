---
id: T2
slug: cancelled-error-code
status: done
depends-on: []
---

# CANCELLED error code

## Goal

Add a `CANCELLED` error code to the `ScifiError` taxonomy so a user-aborted
picker maps to a stable non-zero exit.

## Tests first

New file `tests/core/output/errors.test.ts` (no test file exists for this module
today — exit codes are currently exercised only indirectly via CLI tests):

- `new ScifiError('CANCELLED', 'x').exitCode` is `130`.
- `toScifiError` preserves a `CANCELLED` `ScifiError` unchanged (code stays
  `CANCELLED`).

## Work

- In `src/core/output/errors.ts`: add `'CANCELLED'` to the `ErrorCode` union and
  a `CANCELLED: 130` entry to `EXIT_CODES`.
- **Shared-type note:** `ErrorCode` is widely referenced, but this change is
  additive — existing call sites pass existing codes and keep compiling. The
  `EXIT_CODES` `Record<ErrorCode, number>` is exhaustiveness-checked by TS, so
  the new key is required and the compiler proves no code path is missed. No
  consumer is broken; build stays green.

## Validation

`npm test tests/core/output/errors.test.ts` green; `npm run typecheck` clean.

## Satisfies

Spec AC: aborting init exits non-zero via the existing error channel. Design
module `errors.ts` change.
