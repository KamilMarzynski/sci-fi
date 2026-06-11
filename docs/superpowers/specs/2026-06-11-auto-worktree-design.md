# Automatic per-feature worktree + branch — design

Date: 2026-06-11
Status: approved (pending spec review)

## Problem

`scifi` drives a feature through spec → plan → implement, but says nothing about
where that work lives in git. The skills assume commits exist (`sf-tdd` commits,
`sf-implement` builds a `{BASE}..HEAD` range) yet no step creates a branch or an
isolated workspace. In practice that means work lands on whatever branch is
checked out — including `main`, which CLAUDE.md forbids — and two features in
flight share one working tree, so their `spec.md` / `design.md` collide.

We want every feature to get its **own branch and its own git worktree,
automatically, at inception**, so several features can be in flight at once,
each fully isolated, and none touches `main` until its PR merges.

The CLI deliberately has no git dependency today — it is filesystem bookkeeping
under `docs/scifi/`. We keep that split: the **skills run git** (they already own
commits); the **CLI records the resulting branch + worktree** as bookkeeping so
state is tracked and resume is reliable.

## Goals

- A feature's branch + worktree are created automatically when `sf-feature`
  starts, and the whole lifecycle (spec, plan, implement) runs inside that
  worktree on that branch.
- Branch and worktree names follow this repo's standards:
  - branch `feat/<slug>` for features, `fix/<slug>` for `sf-fix` / `sf-bug`;
  - worktree at `.worktrees/<branch-flattened>` (e.g. `.worktrees/feat-google-auth`),
    matching the existing convention.
- The CLI records the branch + worktree path on the feature and reports them in
  `scifi status`, so `sf-continue` / `sf-change` find the workspace reliably.
- Several features can be worked in parallel without collision.
- `sf-implement` no longer carries the "branch creation is yours" caveat — it is
  automatic and already done by the time implementation starts.

## Non-goals

- The CLI does **not** run git. It stores the pointer the skill hands it; the
  skill executes `git worktree add` / commits.
- No automatic worktree *removal*. Merging is the maintainer's; cleanup happens
  post-merge and is documented, never automated (we never delete unmerged work).
- Worktree root is fixed at `.worktrees/`. Not configurable in this change.
- `sf-bug` stays untracked: it gets a `fix/<slug>` worktree from the skill, but
  no CLI pointer (it has no scifi metadata to record onto).

## Model

One feature = one branch = one worktree, for the feature's whole life.

```
main ──┬─ feat/google-auth   (.worktrees/feat-google-auth)   spec→plan→implement→PR
       ├─ feat/billing       (.worktrees/feat-billing)       spec→plan→implement→PR
       └─ fix/stale-token     (.worktrees/fix-stale-token)    sf-bug / sf-fix → PR
```

- The worktree branches from the repo's default branch (detected; fallback
  `main`).
- `docs/scifi/` (CONTEXT.md, adr/, config) is inherited into the worktree from
  the default branch at branch time; edits to it during grilling are committed on
  the feature branch and merge back via the PR — exactly as `spec.md` does today.

## Flow

### `sf-feature` (new feature)

1. Derive `<slug>`.
2. **Create the workspace (skill runs git):**
   `git worktree add -b feat/<slug> .worktrees/feat-<slug>` off the default
   branch. Enter it; all subsequent work happens here.
3. `scifi spec <slug> --title "..." --json` — creates `docs/scifi/specs/<slug>/`
   on the feature branch.
4. **Record the pointer (CLI bookkeeping):**
   `scifi worktree set <slug> --branch feat/<slug> --path .worktrees/feat-<slug>`.
5. Grill → write spec → review → `scifi spec-ready`.

### `sf-feature` (reopen, via `sf-continue` / `sf-change`)

The worktree already exists. Do **not** create it again. Resolve its path from
`scifi status` (or the `.worktrees/feat-<slug>` convention), enter it, and grill
against the spec already there.

### `sf-plan` / `sf-implement`

Operate inside the feature's worktree. On a resumed run, enter it first (from the
recorded pointer / convention). `sf-implement` drops the "branch creation is
yours / CLI doesn't manage git" note — the worktree and branch already exist; it
still records `{BASE}` (the worktree's branch point) for the handover range.

### `sf-continue`

Resolve the slug → read the worktree pointer from `scifi status <slug> --json`
(fallback: `.worktrees/feat-<slug>` + `git worktree list`) → route the owning
skill to operate in that worktree.

### `sf-change`

Work in the feature's existing worktree. Reopening a `done`+merged feature whose
worktree was cleaned up recreates one off the default branch and re-records the
pointer.

### `sf-fix` / `sf-bug`

Create a `fix/<slug>` worktree off the default branch, do the fix there, open a
PR. `sf-fix` may additionally record the pointer onto the feature (optional);
`sf-bug` records nothing.

## Components

### CLI (the only TypeScript work)

**Metadata** — `src/core/specs/types.ts`: `FeatureMetadata` gains optional
`branch?: string` and `worktreePath?: string`. Optional, so existing metadata
stays valid (`isValidFeatureMetadata` checks required fields only).

**Preserve across transitions** — `src/core/specs/transition.ts`
(`updateFeatureStatus`) and `src/core/specs/create.ts` rebuild metadata field by
field; both must carry `branch` / `worktreePath` through so a status change does
not drop the pointer. This is the subtle part.

**Core module** — `src/core/specs/worktree.ts`: `setFeatureWorktree(projectRoot,
slug, { branch, path })` reads metadata via the existing lifecycle helper, writes
the two fields back, returns `{ id, slug, branch, worktreePath }`. Empty branch
or path → `INVALID_ARGUMENT`; missing feature → `NOT_FOUND` (from the shared
read).

**Command** — `src/cli/commands/worktree.ts`:
`scifi worktree set <slug> --branch <b> --path <p> [--json]`, registered in
`src/cli/index.ts`. Thin wrapper over the core module, matching the existing
command style.

**Status output** — `src/cli/commands/status.ts`: include `branch` and
`worktree` (path) in both JSON and human output when present.

### Skills

- `sf-feature/body.md` — add the "create the workspace" step for new features and
  the "enter the existing worktree" handling for reopen; record the pointer via
  `scifi worktree set`.
- `sf-plan/body.md` — note the session runs in the feature's worktree; resume
  enters it.
- `sf-implement/body.md` — remove the "branch creation is yours / CLI does not
  manage git" caveat; the workspace already exists. Keep `{BASE}` recording.
- `sf-continue/body.md` — read the worktree pointer from `scifi status` and route
  there; add it to the state-reading description.
- `sf-change/body.md` — operate in the existing worktree; recreate on reopen of a
  cleaned-up done feature.
- `sf-fix/body.md`, `sf-bug/body.md` — create the `fix/<slug>` worktree up front,
  before investigation produces commits.

### Docs

- `README.md` — document that each feature gets a `feat/<slug>` branch +
  `.worktrees/feat-<slug>` worktree automatically, and add `scifi worktree set`
  to the CLI reference.
- `ROADMAP.md` — record the two known limitations below under "Known Debt".

## Tests affected

- New `tests/core/specs/worktree.test.ts` — `setFeatureWorktree` happy path,
  `NOT_FOUND`, `INVALID_ARGUMENT`, and **pointer preserved across a status
  transition** (regression for the field-drop risk).
- New `tests/cli/worktree.test.ts` — `scifi worktree set` success + error codes;
  `scifi status` reflects the pointer.
- `tests/cli/status.test.ts` / `tests/core/specs/*` — tolerate the new optional
  fields; assert they surface in status output.
- `tests/e2e/installed-init.test.ts` (or a new e2e) — against the installed
  build: `scifi worktree set` then `scifi status --json` reports branch +
  worktree. Required by CLAUDE.md for user-facing CLI changes.

## Known limitations (record in ROADMAP.md, not solved here)

1. **Feature-ID collision.** `FEAT-NNNN` is derived from the count of `specs/`
   dirs on the current branch, so two features branched from the same `main` can
   compute the same next id until merged. The slug is the real key, so this is
   cosmetic; left as debt.
2. **Cross-branch discovery.** `scifi list` from `main` won't show in-flight
   features — their `specs/<slug>/` lives on their branch. Discovery across
   features is via `git worktree list`. Inherent to per-feature isolation.

## Sequencing

This change edits several skill bodies (`sf-feature`, `sf-plan`, `sf-implement`,
`sf-continue`, `sf-change`, `sf-fix`, `sf-bug`) that are also modified on the
open `fix/skill-consistency` branch (the review-gate fixes). To avoid merge
conflicts and build on the corrected text, this work should stack on
`fix/skill-consistency` (or that branch should merge first). Flagged for the
maintainer; the implementation plan will pick the base accordingly.

## Risks

- `git worktree add` has edge cases (existing path, detached HEAD, dirty default
  branch). The skill must handle a pre-existing worktree on resume (enter, don't
  recreate) and surface failures rather than swallow them.
- The CLI pointer can drift from reality if a user moves/deletes a worktree by
  hand. `scifi status` reports what was recorded; resume falls back to the
  `.worktrees/feat-<slug>` convention + `git worktree list` when the recorded
  path is gone.
