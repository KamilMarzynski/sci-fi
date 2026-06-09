# Skills Init Bundle — Design

- **Date:** 2026-05-29
- **Status:** draft
- **Topic:** Bundle agent skills/subagents in the `scifi` package and install them per-harness during `scifi init`.

## Problem

`scifi init` today scaffolds directories and two bootstrap docs (`TESTING.md`, `ROADMAP.md`). It does not install any agent files. The product needs a workflow library — a set of user-callable skills (`sf-feature`, `sf-plan`, `sf-fix`, `sf-bug`, `sf-implement`) plus internal subagents (`spec-review`, `plan-review`, `code-review`, `verification`, `tdd`) — distributed to the user's harness on init. The user must be able to pick their harness (Claude Code first; others follow later).

A single skill body must update every harness output at once. Editing prose in multiple shapes is unmaintainable.

## Out of scope

- Real prompt content for any skill (stubs only here; bodies land in per-skill follow-up specs).
- Harness adapters other than Claude Code (interface defined; OpenCode / Codex / Cursor / AGENTS.md fallback throw `not implemented`).
- `scifi update` command for regenerating skills (later).
- CLI argument flags beyond `--harness`.

## Success criteria

- `scifi init` (default or `--harness claude-code`) installs all 10 skill files under `.claude/skills/` and `.claude/agents/` of the target project.
- Picking any non-Claude-Code harness exits non-zero with a clear "not implemented" message before any filesystem write.
- Editing `skills/<name>/body.md` once changes the output for every implemented adapter.
- New scaffold docs (`ARCHITECTURE.md`, `CONTEXT.md`, `EVALUATION.md`) ship; `TESTING.md` no longer written by init.
- `.scifi/config.json` records the chosen harness.

## Architecture

### Repository layout

```
sci-fi/
├── skills/                              ← single source of truth (new)
│   ├── sf-feature/{body.md, manifest.ts}
│   ├── sf-plan/{body.md, manifest.ts}
│   ├── sf-fix/{body.md, manifest.ts}
│   ├── sf-bug/{body.md, manifest.ts}
│   ├── sf-implement/{body.md, manifest.ts}
│   ├── spec-review/{body.md, manifest.ts}      (kind: subagent)
│   ├── plan-review/{body.md, manifest.ts}      (kind: subagent)
│   ├── code-review/{body.md, manifest.ts}      (kind: subagent)
│   ├── verification/{body.md, manifest.ts}     (kind: subagent)
│   └── tdd/{body.md, manifest.ts}              (kind: subagent)
├── src/
│   ├── cli/commands/init.ts                    ← edited
│   └── core/
│       ├── init/
│       │   ├── scaffold.ts                     ← edited
│       │   ├── types.ts                        ← edited
│       │   ├── prompt-harness.ts               ← new
│       │   ├── install-skills.ts               ← new
│       │   └── config.ts                       ← new
│       └── skills/                             ← new
│           ├── catalog.ts
│           ├── types.ts
│           └── harness/
│               ├── adapter.ts
│               ├── registry.ts
│               └── claude-code.ts
└── package.json                                ← files[] += "skills"
```

`skills/` is shipped raw via `package.json`. `manifest.ts` files compile into `dist/skills/<id>/manifest.js`; `body.md` is read raw from the package directory at runtime. The CLI resolves the package directory via `new URL(..., import.meta.url)`.

### Skill manifest shape

`src/core/skills/types.ts`:

```ts
export type SkillKind = "user" | "subagent";

export interface SkillManifest {
  id: string;                            // matches folder name
  kind: SkillKind;
  description: string;
  argumentHint?: string;
  allowedTools?: readonly string[];
  disableModelInvocation?: boolean;
  model?: string;                        // subagent only
}

export interface SkillBundle {
  manifest: SkillManifest;
  body: string;                          // raw markdown body, no frontmatter
}
```

`skills/<id>/manifest.ts`:

```ts
import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-feature",
  kind: "user",
  description: "Start grilling session for a new feature; reads ARCHITECTURE.md.",
  argumentHint: "[title]",
  allowedTools: ["Read", "Write", "Glob", "Grep"],
  disableModelInvocation: true,
};
```

The type-only import is via a self-referencing subpath (`scifi/skill-types`) exposed by `package.json` `exports`. That keeps the same import path valid in source (`skills/<id>/manifest.ts`) and in the compiled output (`dist/skills/<id>/manifest.js`), so we do not have to fight `rootDir` or relative depth.

### Catalog loader

`src/core/skills/catalog.ts` walks `skills/<id>/`, dynamically imports the compiled manifest, reads `body.md` from disk, asserts `manifest.id === folderName`, returns `SkillBundle[]`. Throws on duplicates, missing files, or id mismatch.

### Harness adapter

`src/core/skills/harness/adapter.ts`:

```ts
import type { SkillBundle } from "../types.js";

export type HarnessId =
  | "claude-code"
  | "opencode"
  | "codex"
  | "cursor"
  | "agents-md";

export interface HarnessAdapter {
  readonly id: HarnessId;
  install(bundles: readonly SkillBundle[], projectRoot: string): Promise<void>;
}
```

`src/core/skills/harness/registry.ts` maps `HarnessId → HarnessAdapter | NotImplemented`. Only `claude-code` populated. Non-implemented entries throw a typed error before any FS write.

### Claude Code adapter

`src/core/skills/harness/claude-code.ts`:

- `kind: "user"` → `<projectRoot>/.claude/skills/<id>/SKILL.md`
- `kind: "subagent"` → `<projectRoot>/.claude/agents/<id>.md`

User skill frontmatter:

```yaml
---
name: <id>
description: <description>
argument-hint: <argumentHint>            # omit when undefined
allowed-tools: <comma-joined allowedTools> # omit when undefined
disable-model-invocation: true            # omit when false/undefined
---
```

Subagent frontmatter:

```yaml
---
name: <id>
description: <description>
tools: <comma-joined allowedTools>        # omit when undefined
model: <model>                            # omit when undefined
---
```

Followed by a blank line, then the body verbatim.

Idempotency mirrors current `scaffold.ts`: validate target path (must be directory/file or missing), then write. Init writes fresh (no merge); a future `scifi update` will handle re-writes.

### Init flow

`cli/commands/init.ts`:

```ts
const harness = await resolveHarness({
  flag: opts.harness,
  interactive: !opts.yes,
});
await scaffoldInit({ projectRoot });
await installSkills({ projectRoot, harness });
await writeConfig({ projectRoot, harness });
```

`resolveHarness` (`prompt-harness.ts`):

- `--harness <id>` flag → validate against `HarnessId`, return.
- Interactive → prompt with Claude Code as default. Choices: Claude Code, OpenCode, Codex, Cursor, AGENTS.md fallback.
- `--yes` flag without `--harness` → default `claude-code`.
- Prompt library: reuse what `package.json` already pulls in if present; otherwise `node:readline`.

`installSkills` (`install-skills.ts`):

1. Load catalog from package `skills/` dir.
2. Resolve adapter from registry; if `not implemented`, throw `HarnessNotImplementedError` listing the harness id and a tracker pointer. No FS writes.
3. `adapter.install(bundles, projectRoot)`.

`writeConfig` (`config.ts`) writes `<projectRoot>/docs/scifi/.scifi/config.json`:

```json
{ "version": 1, "harness": "claude-code" }
```

`InitOptions` gains `harness?: HarnessId` (resolved upstream; not user-facing) so downstream functions stay pure.

### Scaffold doc changes

`scaffold.ts`:

- Drop the `TESTING.md` bootstrap entry.
- Add `EVALUATION.md` bootstrap entry — same content as current `buildTestingDocument`, header renamed.
- Add `ARCHITECTURE.md` bootstrap entry — template with sections: System overview, Services and boundaries, Communication patterns, Persistence, Tech stack, Constraints, Open decisions.
- Add `CONTEXT.md` bootstrap entry — glossary template with a `## Terms` section and the `### TermName / Definition / Distinct from / Used in` shape.
- `buildAgentsDocument` is currently dead (not in the bootstrap list). Leave as-is — out of scope.

Resulting bootstrap document list grows from 2 to 4.

## Catalog (stubs)

Body for every entry is a stub: `# <id>\n\nTODO: prompt content in follow-up spec.\n`. Manifests are fully typed and final.

User-callable (`kind: "user"`):

| id | description (stub) | argument-hint |
|---|---|---|
| `sf-feature` | Start grilling session for new feature. Reads ARCHITECTURE.md. Asks to update it when work touches structure. Writes spec.md. | `[title]` |
| `sf-plan` | Deep technical planning from approved spec.md. Writes design.md + tasks/. Reads ARCHITECTURE.md, asks to update if needed. | `[spec-id]` |
| `sf-fix` | Open a fix for an existing spec/task. | `[task-ref]` |
| `sf-bug` | Create a bug report. Standalone or spec-nested via `--task`. | `[description]` |
| `sf-implement` | Execute tasks from a plan. Prefers dispatching a subagent per task. Orchestrates. | `[spec-id]` |

Subagent (`kind: "subagent"`):

| id | description (stub) |
|---|---|
| `spec-review` | Critic pass on a spec.md. Surfaces ambiguity, missing AC, CONTEXT.md gaps. |
| `plan-review` | Critic pass on design.md + tasks/. Checks plan vs ARCHITECTURE.md. |
| `code-review` | Quality review of changes against ARCHITECTURE.md and AGENTS.md rules. |
| `verification` | Verify implementation matches spec + plan. Runs user validations from EVALUATION.md. |
| `tdd` | Enforce tests-first discipline. Writes failing test before implementation per task. |

## Error handling

- Catalog load failure (missing `body.md`, missing `manifest.ts`, duplicate id, id mismatch) → typed error, no FS write.
- Unknown harness id (from flag) → typed `InvalidHarnessError`, exit non-zero.
- Adapter not implemented → `HarnessNotImplementedError` before any FS write, exit non-zero with message naming the harness.
- Adapter write failure → propagate. Existing scaffold-level path checks already cover collisions with non-file/non-dir targets.

## Module boundaries

- `src/cli/commands/init.ts` — argument parsing, calls into core. No FS, no prompts.
- `src/core/init/*` — orchestration. May call prompts and FS.
- `src/core/skills/*` — catalog, types, adapters. No CLI deps, no prompt deps.
- `skills/*` — authored content. Manifests reference `src/core/skills/types.ts` for typing only.

## Testing

- `tests/core/skills/catalog.test.ts` — loads catalog from real `skills/`. Asserts 10 entries, ids match folder names, kind split (5 user / 5 subagent).
- `tests/core/skills/harness/claude-code.test.ts` — given fake `SkillBundle[]` and tmp `projectRoot`, asserts files written at correct paths with correct frontmatter and bodies. Parses YAML, compares field-by-field. Covers both `user` and `subagent`.
- `tests/core/init/prompt-harness.test.ts` — flag validation, default, invalid id rejection. Pure logic; UI tested separately if needed.
- `tests/core/init/scaffold.test.ts` (existing) — extend for `ARCHITECTURE.md`, `CONTEXT.md`, `EVALUATION.md`; assert `TESTING.md` no longer written.
- `tests/e2e/init.test.ts` (installed build) — `scifi init --harness claude-code` on tmp dir. Assert `.claude/skills/sf-feature/SKILL.md` exists and parses; `.claude/agents/code-review.md` exists and parses; new scaffold docs present; `.scifi/config.json` records `claude-code`.
- Negative e2e — `scifi init --harness opencode` exits non-zero, error mentions `opencode`, no `.claude/` or scaffold writes occur.

## Package shape

```json
{
  "files": ["dist", "skills"],
  "exports": {
    ".": "./dist/cli/index.js",
    "./skill-types": "./dist/core/skills/types.js"
  }
}
```

`tsconfig.json` adds `skills` as an additional root (`rootDirs: ["src", "skills"]`) and `include` extends to `skills/**/manifest.ts`. Compiled output: `dist/core/skills/types.js` (from `src/`) and `dist/skills/<id>/manifest.js` (from `skills/`). The `scifi/skill-types` self-reference resolves identically in source and in `dist/`. At runtime the catalog resolves the package `skills/` directory (for `body.md`) and `dist/skills/<id>/manifest.js` (for the typed manifest) relative to the CLI module via `import.meta.url`.

## Implementation order

1. `src/core/skills/types.ts`, `harness/adapter.ts`, registry skeleton.
2. `claude-code.ts` adapter — write logic + unit tests.
3. `catalog.ts` loader — unit tests with a fixtures dir.
4. Author 10 stub skills under `skills/`.
5. `prompt-harness.ts`, `install-skills.ts`, `config.ts` — unit tests.
6. Update `scaffold.ts` for new docs; update existing scaffold tests.
7. Wire into `cli/commands/init.ts`; add `--harness` flag.
8. Adjust `tsconfig.json`, `package.json` `files[]`.
9. E2E tests (installed build) covering happy path + not-implemented path.

## Open questions

None.
