# Spec Lifecycle — Design

**Date:** 2026-05-20
**Roadmap item:** 2 — Spec Lifecycle (MVP)
**Scope:** CLI commands and core modules for the full feature lifecycle: created → spec-ready → plan-ready → in-progress → done. Skills and slash commands are out of scope (separate job).

---

## Overview

The spec lifecycle tracks a feature from initial creation through specification, planning, and implementation. The CLI provides deterministic commands that agents call at lifecycle boundaries. Agents write the markdown artifacts; the CLI validates their presence and records state transitions.

---

## File layout

Each feature lives under `docs/scifi/specs/<slug>/`:

```
docs/scifi/specs/<slug>/
├── .scifi.json        ← feature metadata (status, id, slug, title, timestamps)
├── spec.md               ← written by spec-session agent
├── architecture.md       ← written by plan agent
└── tasks/
    ├── <task-slug>.md
    └── ...
```

Task files have YAML frontmatter written by the planning agent. The CLI reads and updates `status` only; `depends-on` is agent-owned and never modified by the CLI.

```yaml
---
id: TASK-001
slug: setup-database
status: pending        # pending | in-progress | done
depends-on: []         # task slugs that must complete first
---
```

Parallelism is derived from `depends-on`, not declared: a task is runnable once all its dependencies are `done`, and any tasks runnable at the same time may run in parallel. To serialize two otherwise-independent tasks, add a `depends-on` edge between them.

---

## Status lifecycle

```
created → spec-ready → plan-ready → in-progress → done
```

Future-aware: `change-requested` will slot in between any existing status without restructuring. `validateStatusTransition` already handles unknown statuses gracefully (passes through with no rules).

---

## CLI commands

### Feature lifecycle

| Command | Validates | Transitions to |
|---|---|---|
| `scifi spec <slug> [--title]` | slug not already taken | `created` |
| `scifi spec-ready <slug>` | `spec.md` exists | `spec-ready` |
| `scifi plan-ready <slug>` | `architecture.md` exists + ≥1 task `.md` in `tasks/` | `plan-ready` |
| `scifi start <slug>` | current status is `plan-ready` | `in-progress` |
| `scifi finish <slug>` | all tasks have status `done` | `done` |
| `scifi list [--status <status>]` | — | read-only |
| `scifi status <slug>` | — | read-only |

### Task commands

| Command | Validates | Mutates |
|---|---|---|
| `scifi task list <slug>` | — | read-only |
| `scifi task start <slug> <task>` | task file exists | task status → `in-progress` |
| `scifi task done <slug> <task>` | task file exists + status is `in-progress` | task status → `done` |

All mutation commands exit non-zero on validation failure (CI-friendly).

---

## Agent call flow

```
/scifi:create <slug> [description]
  → scifi spec <slug>           # create container
  → agent: brainstorm, grill user, write spec.md
  → scifi spec-ready <slug>     # validate + set status

/scifi:plan [slug]
  → agent: plan session, validate plan vs spec (subagent), write architecture.md + tasks/*.md
  → scifi plan-ready <slug>     # validate + set status

/scifi:implement <slug>
  → scifi start <slug>          # set in-progress
  → orchestrator reads tasks (depends-on), dispatches agents
  → per task: scifi task start <slug> <task>
  → task agent: work → eval subagent → repeat until pass
  → per task: scifi task done <slug> <task>   # after code review passes
  → scifi finish <slug>         # all tasks done → done
```

If `/scifi:implement` is called on a feature with status `done`, the agent informs the user and suggests filing a bug (future phase) or using `/scifi:change` (future phase).

---

## Core module layout

### New: `src/core/specs/transition.ts`

```ts
updateFeatureStatus(projectRoot: string, slug: string, targetStatus: FeatureStatus): Promise<void>
```

Reads `.scifi.json`, runs `validateStatusTransition` (extended for `start` and `finish` rules), writes updated status and `updatedAt`.

### New: `src/core/tasks/`

| File | Exports |
|---|---|
| `types.ts` | `TaskStatus`, `TaskMetadata`, `TaskFrontmatter` |
| `paths.ts` | `buildTasksDirectoryPath`, `buildTaskFilePath` |
| `frontmatter.ts` | `readTaskFrontmatter`, `writeTaskFrontmatter` (uses `gray-matter`) |
| `list.ts` | `listTasks(projectRoot, slug): Promise<TaskMetadata[]>` |
| `transition.ts` | `updateTaskStatus(projectRoot, slug, taskSlug, status): Promise<void>` |

### Extended: `src/core/specs/lifecycle.ts`

`validateStatusTransition` gains rules for:
- `in-progress`: requires current status `plan-ready`
- `done`: requires all tasks have status `done` (delegates to `listTasks`)

### New CLI command files

```
src/cli/commands/spec-ready.ts
src/cli/commands/plan-ready.ts
src/cli/commands/start.ts
src/cli/commands/finish.ts
src/cli/commands/list.ts
src/cli/commands/status.ts
src/cli/commands/task.ts   ← subcommand group: list | start | done
```

---

## Dependencies

`gray-matter` — YAML frontmatter parsing/serialization for task files. Already the standard Node.js library for this pattern.

---

## Future-aware notes

- `FeatureStatus` is an `as const` array. Adding `change-requested` is a single-line addition to `types.ts`.
- `validateStatusTransition` passes through statuses with no rules — new statuses don't break existing validation.
- `scifi start` gate (`plan-ready` required) will extend to also accept `change-requested` with a one-line change.
- No other future-proofing. Bug lifecycle, agent install targets, and `scifi:change` are separate roadmap items.

---

## Out of scope

- Skills and slash commands (`/scifi:create`, `/scifi:plan`, `/scifi:implement`) — separate job
- Bug lifecycle (`scifi bug`, roadmap item 3)
- `scifi change` and `change-requested` status (future phase)
- Agent install targets (roadmap item 4)
- `scifi validate` and `scifi update` (roadmap item 5)
