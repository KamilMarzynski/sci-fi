# scifi

[![CI](https://github.com/KamilMarzynski/sci-fi/actions/workflows/ci.yml/badge.svg)](https://github.com/KamilMarzynski/sci-fi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

`scifi` is a TypeScript CLI for specification-driven repository scaffolding. The current bootstrap milestone provides the package/build foundation, the `scifi init` command, a dedicated `.testing/` verification workspace, and installed-build end-to-end coverage.

> **On the name:** this project was originally called `spec-flow` (`sf` for short). It was renamed to `scifi` — the same `sf` short form, now spelled out the fun way. The bundled skills keep their `sf-` prefix.

## Requirements

- Node.js `>=22`
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

```bash
scifi init
scifi spec <slug> [--title "..."]
```

`scifi spec` creates a feature container under `docs/scifi/specs/<slug>/`
and writes `.scifi.json` with the CLI-managed feature identifier and status.

Running `scifi init` in a repository creates:

- `.scifi/`
- `specs/`
- `bugs/`
- `AGENTS.md`
- `TESTING.md`

Existing bootstrap docs are preserved when the target path is already a regular file. The command fails if one of those doc paths already exists as a non-file entry such as a directory.

## Bundled Skills

`scifi init` installs a bundled skill catalog into the chosen harness. For Claude Code that means `.claude/skills/sf-<id>/SKILL.md` for all 13 skills (`sf-feature`, `sf-plan`, `sf-fix`, `sf-bug`, `sf-change`, `sf-continue`, `sf-implement`, `sf-spec-review`, `sf-plan-review`, `sf-code-review`, `sf-receiving-review`, `sf-handover`, `sf-tdd`).

All bundled skills carry the `sf-` prefix so they cannot collide with user-authored skills living in the same directories.

**Ownership:** these files are owned by `scifi`. Rerunning `scifi init` overwrites them in place. If you want to customize behavior, copy the file under a different id (e.g. `my-code-review`) and edit that — your copy will not be touched on rerun.

## Handover (optional HANDOVER.md)

When `sf-implement` finishes a feature, it dispatches the `sf-handover` subagent
to verify the completed work against the feature's `spec.md` and `design.md` and
run a final quality check. This always runs; nothing configures it.

You can optionally add `docs/scifi/HANDOVER.md` to define finishing actions the
orchestrator runs after handover verification passes and before `scifi finish` —
for example smoke tests, opening a pull request, or invoking a skill that
describes your release process. The file is not scaffolded by `scifi init`;
create it yourself when you want it. List the actions in the order they should
run; point to any skills by name. If the file is absent, the feature finishes
with no extra actions.

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
- runs the installed `scifi init` binary in that sandbox
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
