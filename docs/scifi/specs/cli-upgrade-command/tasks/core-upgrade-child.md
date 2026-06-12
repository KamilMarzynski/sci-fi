---
id: "4"
slug: core-upgrade-child
status: done
depends-on:
  - contracts-config
---

# Core: child process spawn module

## Goal

Create `src/core/upgrade/child.ts` with the function that spawns the new scifi binary in internal install mode and parses its `InstallReport`.

## Tests first

- `tests/unit/core/upgrade/child.test.ts`:
  - `spawnSkillInstall`: spawns `<binPath> upgrade --_install --project-root <root> --harnesses <ids>`, parses stdout JSON into `InstallReport`.
  - `spawnSkillInstall`: throws when binary does not exist at `binPath` (checked via `existsSync` before spawn).
  - `spawnSkillInstall`: throws `ScifiError` with child stderr when child exits non-zero.
  - `spawnSkillInstall`: throws `ScifiError` when child stdout is not valid JSON.
  - `spawnSkillInstall`: passes harnesses as comma-separated `--harnesses` argument.

## Work

1. Create `src/core/upgrade/child.ts`:
   - `SkillInstallArgs` type: `{ binPath: string; projectRoot: string; harnesses: readonly HarnessId[] }`
   - `spawnSkillInstall(args: SkillInstallArgs): Promise<InstallReport>`:
     - Check `existsSync(args.binPath)` — throw `ScifiError('INTERNAL', ...)` with path and "re-run npm install -g manually" hint if missing.
     - Spawn `<binPath> upgrade --_install --project-root <args.projectRoot> --harnesses <comma-separated-ids>`.
     - Parse stdout as JSON and validate it matches `InstallReport` shape.
     - On non-zero exit: throw `ScifiError` with child's stderr.
     - On unparseable stdout: throw `ScifiError('INTERNAL', ...)` with raw stdout snippet.
   - Import `InstallReport` type from `src/core/init/install-skills.ts`.

## Validation

```bash
npm run check && npm test -- --project unit
```

New child module unit tests pass. No existing tests break.

## Satisfies

- Spec: child process spawns new binary for skill re-install
- Spec: child process failure → reported with child's error
- Spec: new binary missing → error with path and manual re-run hint
