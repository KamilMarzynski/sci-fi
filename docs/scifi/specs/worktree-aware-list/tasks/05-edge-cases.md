---
id: TASK-005
slug: edge-cases
status: done
depends-on:
  - TASK-003
  - TASK-004
---

# Edge cases and fallback behavior

## Goal

Harden the worktree-aware paths against the boundary conditions named in the spec.

## Tests first

- `tests/core/specs/worktree-discovery.test.ts`
  - `isCurrent` is true for the worktree whose root is an ancestor of `process.cwd()`, even when `process.cwd()` is a subdirectory.
  - A worktree path that no longer exists on disk is still returned by the parser but is skipped by consumers (verified via fake-provider unit tests for `listFeatures` and `resolveFeatureLifecycle`).
- `tests/core/specs/list.test.ts` and `tests/core/specs/lifecycle.test.ts`
  - Non-git directory: provider returns `[]`; output is local-only.
  - Git failure: provider returns `[]`; output is local-only.
  - Current-checkout exclusion: a feature in the current checkout is not duplicated with a `worktree:` location.

## Work

1. Confirm `GitWorktreeProvider` returns `[]` on subprocess failure and when run outside a git repository.
2. Confirm `listFeatures` and `resolveFeatureLifecycle` skip worktree entries whose `isCurrent` flag is true.
3. Confirm missing/unreadable worktree paths do not propagate errors; they simply contribute no metadata.
4. Add CLI-level tests for:
   - `scifi list` outside a git repo succeeds and shows only local features.
   - `scifi list` after `git worktree list` failure (simulate by overriding PATH) falls back to local-only.
   - `scifi status <slug>` outside a git repo preserves `NOT_FOUND` when the feature is absent locally.

## Validation

```bash
npm test tests/core/specs/worktree-discovery.test.ts tests/core/specs/list.test.ts tests/core/specs/lifecycle.test.ts tests/cli/list.test.ts tests/cli/status.test.ts
```

## Satisfies

- "`scifi list` and `scifi status <slug>` exclude the current checkout's own entry from `git worktree list`."
- "`scifi list` invoked outside a git repository exits successfully and shows only local features."
- "`scifi status <slug>` invoked outside a git repository preserves existing local-only behavior."
- "When `git worktree list` fails or git is absent, `scifi list` and `scifi status` fall back to local-only behavior without surfacing an error."
