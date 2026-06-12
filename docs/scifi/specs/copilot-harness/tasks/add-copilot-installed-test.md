---
id: T4
slug: add-copilot-installed-test
status: done
depends-on:
  - T1
---

# Add installed-build e2e test for github-copilot harness

## Goal

Verify that a packaged, installed build of scifi can initialize with `github-copilot` and produces `.github/skills/sf-feature/SKILL.md`.

## Tests first

Add to `tests/e2e/installed-init.test.ts`:
- A test that calls `runInstalledInit(installation.installDirectory, ['--harness', 'github-copilot', '--yes'])` and asserts:
  - `result.status` is 0
  - `result.stderr` is empty
  - `.github/skills/sf-feature/SKILL.md` exists
  - `docs/scifi/.scifi/config.json` contains `harnesses: ['github-copilot']`

Use the existing `createInstalledPackageTestEnvironment` / `cleanupInstalledPackageTestEnvironment` pattern.

## Work

1. `tests/e2e/installed-init.test.ts`:
   - Add the Copilot installed-build test.

**Call sites affected:** None — this is a new test that exercises existing helpers and the installed CLI binary.

## Validation

```bash
npm test tests/e2e/installed-init.test.ts
```

All tests in the file must pass, including the new one.

## Satisfies

- Installed-build end-to-end test verifies `scifi init --harness github-copilot --yes` produces `.github/skills/sf-feature/SKILL.md`
