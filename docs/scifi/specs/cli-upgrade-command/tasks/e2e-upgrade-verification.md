---
id: "6"
slug: e2e-upgrade-verification
status: done
depends-on:
  - cli-upgrade-command
---

# E2E: installed-build upgrade verification

## Goal

End-to-end tests that verify the full `scifi upgrade` flow from an installed build in the `.testing/` sandbox, covering success paths, error paths, and output correctness.

## Tests first

- `tests/e2e/installed-upgrade.test.ts`:
  - **Full success path:** init a repo with `--harness claude-code --harness cursor`, run `upgrade --yes --json`, verify:
    - Exit code 0.
    - JSON output has all required keys (`action`, `previousVersion`, `newVersion`, `npmUpgraded`, `harnesses`, `installed`, `failed`).
    - `npmUpgraded` is `true`.
    - `installed` array contains entries for both harnesses with correct `baseDir` and `skills` arrays.
    - Config file unchanged (same `version` and `harnesses`).
    - Skill files exist in both harness dirs.
  - **Already-at-latest:** mock npm to return the same version, verify `npmUpgraded: false`, skills still re-installed.
  - **Missing config:** run upgrade in a dir without init, verify non-zero exit and "not initialized" message.
  - **Invalid harness in config:** manually write config with an unknown harness ID, verify it's skipped with warning, valid harnesses proceed.
  - **Zero valid harnesses:** manually write config with only invalid harness IDs, verify error.
  - **npm failure:** mock npm to fail, verify error before skill re-install (no harness dirs created).
  - **Child process failure:** mock the new binary to exit non-zero, verify parent reports child's error.

## Work

1. Create `tests/e2e/installed-upgrade.test.ts`:
   - Use the existing `installed-test-helpers.ts` patterns (`createInstalledPackageTestEnvironment`, `runInstalledCommand`, `cleanupInstalledPackageTestEnvironment`).
   - Add a helper to create a mock `npm` script in the sandbox PATH that records invocations and returns controlled output (version strings, success/failure).
   - For the child process: the test installs the real scifi package, so the child is the same binary. To test child failure, manipulate the harness config to trigger an error, or use a separate mock approach.
   - For npm phase verification: create a mock `npm` shell script in a temp dir added to PATH. The mock records arguments and returns configured responses (success with version bump, "up to date", failure with EACCES, etc.).
   - Each test case creates a fresh sandbox, inits it, runs upgrade, and asserts outcomes.
   - Clean up sandboxes after each test.

## Validation

```bash
npm run check && npm test -- --project e2e
```

All e2e tests pass. Installed-build verification confirms the packaged CLI behaves correctly.

## Satisfies

- Spec: end-to-end test verifies full flow
- Spec: installed-build verification
- Spec: all error paths (missing config, malformed config, npm failure, child failure, invalid harnesses, zero valid harnesses)
- Spec: already-at-latest behavior
- Spec: `--json` output shape
