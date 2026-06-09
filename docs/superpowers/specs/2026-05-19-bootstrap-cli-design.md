# Bootstrap CLI Design

**Date:** 2026-05-19
**Status:** Draft for review
**Scope:** First sub-project of `scifi`

## Goal

Create the initial production-shaped scaffold for `scifi`: a published-package-ready TypeScript CLI with a clean internal module layout, strict engineering standards, and the first foundation for `scifi init`.

## Why This First

`scifi` depends on a stable CLI shell before any feature-specific commands make sense. The bootstrap layer establishes package shape, build/test conventions, internal boundaries, and repository rules that later specs can build on without rework.

## Decisions

### Package and Runtime

- Runtime: Node.js
- Language: TypeScript
- Package manager baseline: npm
- Distribution target: published npm package shape from day one

This keeps install and publishing behavior conventional while still allowing contributors and users to work with `pnpm` if they choose.

### CLI Framework

- CLI framework: `commander`

`commander` is mature, predictable, and sufficient for this project without imposing unusual structure.

### Test Stack

- Test runner: `vitest`

`vitest` gives fast execution and straightforward TypeScript support, which is a good fit for a CLI project that will need both focused unit tests and filesystem-oriented integration tests.

## Proposed Structure

```text
scifi/
├── package.json
├── tsconfig.json
├── AGENTS.md
├── ROADMAP.md
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   ├── core/
│   ├── templates/
│   └── utils/
├── tests/
└── docs/
    └── superpowers/
        └── specs/
```

## Architecture

The codebase should remain a single publishable package, but with strict separation between CLI wiring and domain logic.

- `src/cli/` owns argument parsing, command registration, help text, and process exit behavior.
- `src/core/` owns business logic such as scaffolding, configuration loading, and project file generation.
- `src/templates/` owns bundled markdown or file templates that later commands will materialize into user repositories.
- `src/utils/` is reserved for small focused helpers, not dumping ground abstractions.
- `tests/` should cover both pure logic and end-to-end command behavior against temporary directories.

This gives us monorepo-like separation without monorepo overhead.

## First Functional Slice

The first implemented command in this sub-project should be `scifi init`.

Initial behavior for that command:

- create a project config file under `.scifi/`
- create base documentation files needed by later workflows
- create empty `specs/` and `bugs/` directories
- establish the installation/update pattern that future commands can extend

The first slice does not need to fully support every agent target yet, but it must be shaped so those targets can be added without redesigning the CLI.

## Quality Rules

This project should be treated as a production-ready tool from the start.

- TypeScript strict mode is required.
- `any` is not allowed.
- Type assertions/casts should be avoided; if an external boundary forces one, it must be isolated and justified.
- Core logic must be covered by tests.
- Filesystem-generating behavior must be tested with realistic integration tests.
- Public behavior changes should be reflected in documentation in the same change.

## Risks and Constraints

- If command handlers contain business logic, the CLI will become difficult to test and extend.
- If templates and scaffolding logic are not isolated early, `init`, `update`, and validation behavior will drift apart later.
- If typing discipline is relaxed early, later agent-generated changes will likely amplify that weakness across the codebase.

## Success Criteria

This sub-project is complete when the repository contains:

- a publishable npm package shape
- a working TypeScript build to `dist/`
- a `commander`-based CLI entrypoint
- a `vitest` test setup
- a stable internal folder structure
- repository-level agent guidance in `AGENTS.md`
- the initial foundation for `scifi init`

## Out of Scope

The following are intentionally deferred to later sub-projects:

- full spec creation workflow
- bug lifecycle and nesting rules
- agent-target installation details for Claude Code, OpenCode, and Codex
- validation schemas and update mechanics
- packaging polish beyond what is needed for the initial scaffold
