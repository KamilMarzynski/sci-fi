# Spec Lifecycle Design

**Date:** 2026-05-20
**Status:** Draft for review
**Scope:** Second sub-project of `specflow`

## Goal

Define the first durable feature lifecycle contract for `specflow`.

This sub-project should not try to encode the full authoring workflow into the CLI. Instead, it should establish the repository shape, CLI-owned metadata, and status transitions that agent slash commands can rely on when driving feature work.

## Why This Next

The bootstrap layer is already in place. The next missing piece is a stable way to represent a feature inside the repository so later slash commands, skills, and validation logic can coordinate around the same source of truth.

Without this layer, feature work remains informal: there is no canonical feature container, no CLI-owned state, and no deterministic way for an agent to resume work based on repository contents.

## Decisions

### Feature Path

`specflow`-managed features live under:

```text
docs/specflow/specs/<slug>/
```

This path is intentionally namespaced under `docs/specflow/` so `specflow` does not compete with other frameworks or repository-local conventions that may also create specification artifacts.

### Folder Naming

- Feature folders are slug-based.
- The slug is user- or agent-provided.
- The folder name is not derived from the CLI-generated feature ID.

Example:

```text
docs/specflow/specs/user-auth/
```

This keeps the filesystem readable and user-owned. It also avoids binding repository paths to an internal ID strategy that may change later.

### CLI Identity vs Filesystem Identity

- `specflow` generates an internal feature ID.
- The generated ID is stored in metadata.
- The generated ID is not used in the folder name.

The ID exists for CLI-layer management and future lookup behavior, but the visible repository identity of a feature remains the slug.

### Initial Command Shape

The entry command for this sub-project is:

```bash
specflow spec <slug> [--title "..."]
```

Behavior:

- create `docs/specflow/specs/<slug>/`
- create `docs/specflow/specs/<slug>/.specflow.json`
- do not create `spec.md`
- do not create `architecture.md`
- do not create `tasks/`

This command is intentionally minimal. In the expected workflow it will usually be invoked by an agent-facing slash command such as `/specflow:start ...`, not typed directly by a user.

### Authoring Responsibility

The CLI owns durable storage and lifecycle state.

Skills and slash commands own authoring behavior.

That means:

- the CLI should not freeze document templates too early
- the CLI should not try to encode research prompts or writing guidance
- `spec.md`, `architecture.md`, and task files remain agent-authored artifacts

This separation keeps the CLI stable while allowing authoring workflows to evolve faster.

### Technical Design Artifact

The technical design artifact for a feature is:

```text
architecture.md
```

This file captures technical decisions, architectural boundaries, and implementation-shaping constraints for a feature.

It is not the full implementation plan by itself. The executable implementation plan is the combination of:

- `architecture.md`
- `tasks/*.md`

### Task Model

Implementation planning is task-based.

- task files live under `docs/specflow/specs/<slug>/tasks/`
- each task is a separate `.md` file
- task filenames are human-readable and agent-named
- task filenames are not CLI-generated IDs

Readable task filenames are important because an orchestrator agent may later dispatch subagents by task, and the filename itself should hint at the work to be done.

## Proposed Structure

### At Creation Time

```text
docs/
└── specflow/
    └── specs/
        └── user-auth/
            └── .specflow.json
```

### After Spec Drafting

```text
docs/
└── specflow/
    └── specs/
        └── user-auth/
            ├── .specflow.json
            └── spec.md
```

### After Planning

```text
docs/
└── specflow/
    └── specs/
        └── user-auth/
            ├── .specflow.json
            ├── spec.md
            ├── architecture.md
            └── tasks/
                ├── define-session-boundary.md
                └── add-auth-storage-contract.md
```

## Metadata Contract

Each feature folder contains a CLI-owned metadata file:

```text
docs/specflow/specs/<slug>/.specflow.json
```

Initial recommended shape:

```json
{
  "version": 1,
  "id": "FEAT-0001",
  "slug": "user-auth",
  "title": "User Auth",
  "status": "created",
  "createdAt": "2026-05-20T06:29:55Z",
  "updatedAt": "2026-05-20T06:29:55Z"
}
```

Field intent:

- `version`: schema version for future migrations
- `id`: internal CLI-managed identifier
- `slug`: canonical folder slug
- `title`: optional display title for agent and CLI output
- `status`: lifecycle state
- `createdAt`: feature creation time
- `updatedAt`: last CLI-managed state update

The metadata file is the CLI-owned coordination layer. User-authored markdown files remain separate so commands can make deterministic decisions without over-trusting mutable document contents.

## Lifecycle Model

### States

- `created`
- `spec-ready`
- `plan-ready`
- `in-progress`
- `done`

### State Meanings

`created`

- The feature container exists.
- Research may still be needed.
- A draft spec may or may not exist yet.
- The feature has not been accepted into planning.

`spec-ready`

- `spec.md` exists.
- The spec has been accepted.
- The feature is ready to enter planning.

`plan-ready`

- `architecture.md` exists.
- `tasks/` exists.
- `tasks/` contains at least one task file.
- The implementation plan has been accepted and there is executable work to do.

`in-progress`

- Implementation is underway, or active bug/repair work has moved the feature into execution state.

`done`

- The feature lifecycle is considered complete.

## Resume Behavior

This state model is designed to support a later `/specflow:continue <slug>` flow that can infer the next step from repository state.

Expected behavior:

- `created` + no `spec.md`: continue with research and spec drafting
- `created` + `spec.md`: continue with spec review or acceptance
- `spec-ready`: continue with planning
- `plan-ready`: continue with execution
- `in-progress`: continue implementation or bugfix work

This avoids the need for extra resume flags and keeps the workflow inspectable from files on disk.

## Transition Rules

The CLI should be strict about lifecycle transitions.

- commands should validate required artifacts before updating status
- commands should fail with precise reasons when the target state is not structurally valid
- commands should not silently create missing planning artifacts during a state transition

Examples:

- a command that marks `spec-ready` must fail if `spec.md` is missing
- a command that marks `plan-ready` must fail if `architecture.md` is missing
- a command that marks `plan-ready` must fail if `tasks/` is missing or contains no task files

This keeps the CLI honest and prevents hidden state drift between metadata and repository contents.

## Recommended Command Scope

This sub-project should focus on lifecycle primitives, not the entire downstream workflow.

Recommended minimum scope:

- `specflow spec <slug> [--title "..."]`
- core logic for reading and writing `.specflow.json`
- core logic for validating feature lifecycle state
- thin CLI transitions for later slash-command integration

The exact transition command names can still be decided later, but the lifecycle contract should be designed now so later commands do not have to reinterpret feature state.

## Architecture

This sub-project should preserve the repository rule that commands remain thin and business logic stays reusable.

- `src/cli/commands/` should own argument parsing and output
- `src/core/` should own feature creation, metadata updates, and transition validation
- `src/templates/` should not own spec templates yet, because the CLI is intentionally not the source of authoring structure in this phase

The CLI should act as a stateful repository primitive behind agent slash commands, not as a document-writing workflow engine.

## Risks and Constraints

- If folder names depend on generated IDs, future changes to ID strategy will cause needless path churn.
- If the CLI creates too many authoring artifacts too early, later skills will be forced to inherit premature template decisions.
- If metadata is stored only in markdown frontmatter, later commands will need to infer state from mutable user-authored files, which is fragile.
- If `plan-ready` does not require task files, the status stops meaning there is actual executable work ready to start.

## Success Criteria

This sub-project is complete when:

- `specflow spec <slug> [--title "..."]` creates a namespaced feature container under `docs/specflow/specs/`
- each created feature contains a valid `.specflow.json`
- the CLI can distinguish feature lifecycle states from metadata plus artifact presence
- the lifecycle contract supports deterministic resume behavior for later slash commands
- the implementation does not create `plan.md`
- the implementation does not require ID-based folder names

## Out of Scope

The following are intentionally deferred:

- exact slash-command names and installation targets
- authoring templates for `spec.md`, `architecture.md`, or task files
- bug lifecycle details beyond acknowledging later transitions to `in-progress`
- global feature registries such as `.specflow/specs.json`
- multi-framework interoperability beyond isolating `specflow` artifacts under `docs/specflow/`
