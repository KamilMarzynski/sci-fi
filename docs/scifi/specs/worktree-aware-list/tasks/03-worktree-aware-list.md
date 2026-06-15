---
id: TASK-003
slug: worktree-aware-list
status: pending
depends-on: [TASK-001, TASK-002]
---

# Make scifi list worktree-aware

## Goal

Merge local feature metadata with metadata from linked worktrees, applying the precedence and sorting rules from the spec.

## Tests first

- `tests/core/specs/list.test.ts`
  - With a fake provider returning one linked worktree, a feature absent locally but present there appears in results with `location: worktree:<path>`.
  - A feature present locally and in a worktree uses local metadata and `location: local`.
  - Multiple worktrees with the same slug select the lexicographically smallest path.
  - `--status` filter matches a worktree-only feature.
  - Results are sorted alphabetically by slug regardless of location.
- `tests/cli/list.test.ts`
  - Create a temp git repo, add a feature on `main`, add a worktree on `feat/other`, create a second feature there, and assert `scifi list` shows both with correct locations.

## Work

1. Extend `ListFeaturesOptions` in `src/core/specs/list.ts` with an optional `worktreeProvider?: WorktreeProvider`.
2. Implement internal helper `loadFeaturesFromWorktree(projectRoot, worktreePath)` that reuses the existing metadata reading logic on a different project root.
3. Merge sources:
   - Load local features.
   - Ask `worktreeProvider.discover(projectRoot)`; exclude `isCurrent`.
   - For each remaining worktree, load its features; skip missing/unreadable paths and invalid metadata.
   - Add worktree features only for slugs not already in the local set.
   - For duplicate worktree slugs, keep the lexicographically smallest absolute path.
4. Sort final list by `metadata.slug`.
5. Apply `status` filter after the merge.
6. Wire `createGitWorktreeProvider()` into `src/cli/commands/list.ts`.
7. In the command handler, render `-` in the open-fix column when `location !== 'local'`.

## Validation

```bash
npm test tests/core/specs/list.test.ts tests/cli/list.test.ts
```

## Satisfies

- "`scifi list` run from `main` includes features whose metadata exists only in a linked `Worktree`."
- "When the same slug exists in the current checkout and in a worktree, `scifi list` uses the local metadata and reports `location: local`."
- "`scifi list --status <status>` filters after merging local and worktree sources."
- "`scifi list` rows remain sorted alphabetically by slug."
- "`scifi list` rows for worktree-only features show `-` in the open-fix column."
- "When a feature slug exists in multiple linked `Worktree`s ... pick the source with the lexicographically smallest absolute worktree-path root."
