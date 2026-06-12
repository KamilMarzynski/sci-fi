---
id: "1"
slug: contracts-config
status: done
depends-on: []
---

# Contracts: config reading & package version extraction

## Goal

Add `readConfig()` and `Config` type to the config module, and extract `readPackageVersion` to a shared module so the upgrade command can read harness configuration and detect the current scifi version.

## Tests first

- `tests/unit/core/init/config.test.ts` — `readConfig`:
  - Returns valid `Config` for a well-formed config file.
  - Throws `NOT_FOUND` when config file is missing (message includes "not initialized" and `scifi init` hint).
  - Throws `INVALID_ARGUMENT` when JSON is malformed.
  - Throws `INVALID_ARGUMENT` when `harnesses` key is missing.
  - Throws `INVALID_ARGUMENT` when `harnesses` is not an array.
  - Throws `INVALID_ARGUMENT` when `harnesses` contains non-string entries.
  - Filters invalid harness IDs (not in `KNOWN_HARNESS_IDS`) and warns via `console.warn`.
  - Deduplicates duplicate harness entries.
  - Throws `INVALID_ARGUMENT` when harnesses array is empty after filtering.
  - Handles config with `version` field present (any number — not validated beyond type).
- `tests/unit/core/package-version.test.ts` — `readPackageVersion`:
  - Returns version string for valid package.json.
  - Throws when `version` field is missing.
  - Throws when `version` is not a string.

## Work

1. Add `Config` interface and `readConfig()` to `src/core/init/config.ts`:
   - `Config`: `{ version: number; harnesses: HarnessId[] }`
   - `readConfig(projectRoot: string): Promise<Config>` — reads `docs/scifi/.scifi/config.json`, parses JSON, validates structure, filters/deduplicates harnesses, throws on missing/malformed/empty.
   - Invalid harness IDs: filter out with `console.warn`, don't throw.
   - Reuse `isHarnessId` and `KNOWN_HARNESS_IDS` from `src/core/skills/harness/adapter.ts`.
2. Create `src/core/package-version.ts`:
   - Export `readPackageVersion(packageRoot: string): string`.
   - Use `createRequire` to load `package.json` from the given root.
   - Validate `version` exists and is a string; throw descriptive error otherwise.
3. Update `src/cli/index.ts`:
   - **Call site affected:** local `readPackageVersion` function (lines 25-37) and its use on line 44 (`program.version(readPackageVersion(packageJson))`).
   - Replace local function with import from `src/core/package-version.ts`.
   - Compute `packageRoot` via `findPackageRoot(import.meta.url)` and pass it to the imported function.
   - Remove the local `require` and `packageJson` variables if no longer needed (verify no other consumers).

## Validation

```bash
npm run check && npm test -- --project unit
```

All existing tests pass. New config and package-version unit tests pass.

## Satisfies

- Spec: missing config → "not initialized" error
- Spec: malformed config → clear error message
- Spec: invalid harnesses → skip with warning
- Spec: zero valid harnesses → error
- Spec: `cwd()` as project root (config path resolution)
