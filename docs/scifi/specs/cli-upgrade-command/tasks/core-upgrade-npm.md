---
id: "2"
slug: core-upgrade-npm
status: done
depends-on:
  - contracts-config
---

# Core: npm spawn module

## Goal

Create `src/core/upgrade/npm.ts` with functions to run `npm install -g`, resolve the global prefix, and compute the platform-specific binary path.

## Tests first

- `tests/unit/core/upgrade/npm.test.ts`:
  - `npmGlobalInstall`: spawns `npm install -g scifi@latest`, returns stdout/stderr/exitCode on success.
  - `npmGlobalInstall`: throws `ScifiError` with permission hint when spawn fails with EACCES/EPERM.
  - `npmGlobalInstall`: throws `ScifiError` with "npm may not be available" hint when spawn fails with ENOENT.
  - `npmGlobalInstall`: throws `ScifiError` with npm stderr on non-zero exit.
  - `npmGlobalPrefix`: spawns `npm prefix -g`, returns trimmed stdout.
  - `npmGlobalPrefix`: throws on non-zero exit with npm stderr.
  - `resolveGlobalBinPath`: on Unix, returns `<prefix>/bin/<name>`.
  - `resolveGlobalBinPath`: on Windows, returns `<prefix>/<name>.cmd`.
  - `resolveGlobalBinPath`: on Windows when prefix has no `bin` subdirectory (npm global prefix on Windows is the prefix itself).

## Work

1. Create `src/core/upgrade/npm.ts`:
   - `NpmSpawnResult` type: `{ stdout: string; stderr: string; exitCode: number }`
   - `npmGlobalInstall(packageName: string): Promise<NpmSpawnResult>` — spawn `npm install -g <package>@latest` via `child_process.spawn` (or `execFile`), capture output, classify errors.
   - `npmGlobalPrefix(): Promise<string>` — spawn `npm prefix -g`, return trimmed stdout.
   - `resolveGlobalBinPath(prefix: string, binName: string): string` — pure function, platform-aware path joining.
   - Use `spawn` with `shell: false` for reliable process execution.
   - Map spawn errors (ENOENT, EACCES, EPERM) to `ScifiError` with appropriate hints.
   - On non-zero exit, include stderr in error message.

## Validation

```bash
npm run check && npm test -- --project unit
```

New npm module unit tests pass. No existing tests break (new module, no consumers yet).

## Satisfies

- Spec: npm install -g failure → error before skill re-install
- Spec: permission denied → hint about sudo/npm prefix
- Spec: npm not installed → clear error
- Spec: child process uses resolved binary path (platform-specific extension)
