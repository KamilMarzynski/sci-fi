# specflow

`specflow` is a TypeScript CLI for specification-driven repository scaffolding. The current bootstrap milestone provides the package/build foundation, the `specflow init` command, a dedicated `.testing/` verification workspace, and installed-build end-to-end coverage.

## Requirements

- Node.js `>=20`
- npm

## Bootstrap Development Usage

Install dependencies:

```bash
npm install
```

Run the standard local checks:

```bash
npm run typecheck
npm run build
npm test
npm run coverage
```

Run the CLI from the built output:

```bash
npm run build
node dist/cli/index.js init
```

## Current Command Surface

The bootstrap milestone currently exposes one command:

```bash
specflow init
```

Running `specflow init` in a repository creates:

- `.specflow/`
- `specs/`
- `bugs/`
- `AGENTS.md`
- `TESTING.md`
- `ROADMAP.md`

Existing bootstrap docs are preserved when the target path is already a regular file. The command fails if one of those doc paths already exists as a non-file entry such as a directory.

## Installed-Build Verification

User-facing CLI changes must be verified from an installed package, not only from source-level tests. This repository keeps that workflow under `.testing/`.

Tracked workspace layout:

```text
.testing/
├── artifacts/
└── sandboxes/
```

The automated installed-build verification is covered by `tests/e2e/installed-init.test.ts`. It:

- packs the current package into `.testing/artifacts/`
- creates a disposable install sandbox under `.testing/sandboxes/`
- installs the packed artifact offline
- runs the installed `specflow init` binary in that sandbox
- removes the temporary verification directories after the run

Run the full required verification set for the bootstrap milestone:

```bash
npm run typecheck
npm run build
npm test
npm run coverage
```

For an explicit installed-build-only check during local work, run:

```bash
npm test -- --run tests/e2e/installed-init.test.ts
```
