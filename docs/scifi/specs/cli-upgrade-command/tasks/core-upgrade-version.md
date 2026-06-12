---
id: "3"
slug: core-upgrade-version
status: done
depends-on:
  - contracts-config
---

# Core: version detection module

## Goal

Create `src/core/upgrade/version.ts` with functions to read the current scifi version and detect the new version from a freshly installed binary.

## Tests first

- `tests/unit/core/upgrade/version.test.ts`:
  - `readCurrentVersion`: returns version string from a valid package root (delegates to `readPackageVersion`).
  - `readNewVersion`: spawns `<binPath> --version`, parses version from stdout (e.g. `"1.1.0"` from `"1.1.0"` or `"scifi 1.1.0"`).
  - `readNewVersion`: throws when spawn fails (binary missing, non-zero exit).
  - `readNewVersion`: throws when stdout cannot be parsed as a version.

## Work

1. Create `src/core/upgrade/version.ts`:
   - `readCurrentVersion(packageRoot: string): string` — delegates to `readPackageVersion` from `src/core/package-version.ts`.
   - `readNewVersion(binPath: string): Promise<string>` — spawn `<binPath> --version` via `child_process.execFile`, parse stdout to extract version string.
   - Version parsing: trim stdout, strip leading `"v"` if present, strip program name prefix if present (e.g. `"scifi "`), return the version token.
   - Throw `ScifiError` on spawn failure or unparseable output.

## Validation

```bash
npm run check && npm test -- --project unit
```

New version module unit tests pass. No existing tests break.

## Satisfies

- Spec: version change display (from → to)
- Spec: already at latest detection (version comparison)
- Spec: downgrade direction noted explicitly
