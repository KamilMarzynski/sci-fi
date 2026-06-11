---
id: T5
slug: best-effort-install
status: done
depends-on:
  - T1
  - T2
---

# Best-effort install across the harness list with a per-harness report

## Goal

`installSkills` installs the catalog into every selected harness, continuing past
a per-harness failure, and returns a structured report of successes and failures.

## Tests first

- `tests/core/init/install-skills.test.ts` (update):
  - all selected harnesses succeed → `installed` has one entry per harness (with
    `harness`, `baseDir`, `skills`), `failed` empty.
  - one harness's `install` throws → it appears in `failed`; the others still
    install and appear in `installed`.
  - every harness fails → `installed` empty, `failed` has all.
  - the catalog is loaded exactly once regardless of harness count (spy on
    `loadCatalog` or count fs reads).

## Work

- `install-skills.ts`: change signature to `installSkills({ projectRoot;
  harnesses: readonly HarnessId[]; packageRoot }): Promise<InstallReport>`.
- Load the catalog once; loop harnesses; `getAdapter(id)`; `await
  adapter.install(...)` inside try/catch; push to `installed` (with
  `adapter.skillsBaseDir` and bundle ids) or `failed` (with the error).
- Define `InstallReport = { installed: Array<{ harness; baseDir; skills:
  string[] }>; failed: Array<{ harness; error: Error }> }`.

## Validation

`npm test tests/core/init/install-skills.test.ts`.

## Satisfies

Spec AC: best-effort install; report which succeeded/failed; success if ≥1, error
if all fail (exit decision made in T6); emit lists locations.
