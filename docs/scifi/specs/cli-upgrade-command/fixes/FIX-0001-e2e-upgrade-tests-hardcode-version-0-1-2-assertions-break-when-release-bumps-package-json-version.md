---
id: FIX-0001
slug: e2e-upgrade-tests-hardcode-version-0-1-2-assertions-break-when-release-bumps-package-json-version
status: resolved
feature: cli-upgrade-command
created: 2026-06-13T12:40:56.605Z
---
# e2e upgrade tests hardcode version 0.1.2; assertions break when release bumps package.json version

## Root cause

`tests/e2e/installed-upgrade.test.ts` hardcoded the literal `'0.1.2'` for
`previousVersion`/`newVersion` and for the already-at-latest mock scifi
`versionOutput`. `previousVersion` is read at runtime from the installed
package's `package.json` (`upgrade.ts` → `readCurrentVersion` →
`readPackageVersion`), so any release that bumps the version broke those
assertions and flipped `npmUpgraded` to true in the already-at-latest case —
the red CI on the release merge branch.

## Solution

Read the version once from the repo `package.json` (the same file the release
bumps) via a typed `readRepositoryVersion()` helper and use it for all four
sites, making the assertions version-agnostic.

## Regression guard

The repaired assertions in `installed-upgrade.test.ts` are the guard:
reproduced red by bumping the version to `0.2.0` (failed at the hardcoded
sites), then green at both `0.2.0` and `0.1.2` after the fix. Full suite
(263 tests) and `biome check` pass.
