---
id: TASK-001
slug: worktree-provider-seam
status: done
depends-on: []
---

# Worktree provider seam and git parser

## Goal

Introduce the `WorktreeProvider` interface and a git-backed implementation that can enumerate linked worktrees, normalize their paths, and identify the current checkout.

## Tests first

- `tests/core/specs/worktree-discovery.test.ts`
  - Parses a typical `git worktree list --porcelain` block into absolute `LinkedWorktree` entries.
  - Marks the worktree whose root contains `process.cwd()` as `isCurrent`.
  - Handles relative worktree paths by resolving them against the project root.
  - Returns an empty array for malformed or empty git output.
  - `GitWorktreeProvider.discover` returns `[]` when `.git` is missing (not a repo) and when git is not on PATH.

## Work

1. Add `LinkedWorktree` and `WorktreeProvider` interfaces to a new file `src/core/specs/worktree-discovery.ts`.
2. Implement `createGitWorktreeProvider(): WorktreeProvider` that runs `git worktree list --porcelain` from `projectRoot`.
3. Parse the porcelain output: each worktree block starts with `worktree <path>`; resolve `<path>` to an absolute path.
4. Determine `isCurrent` by checking whether the resolved path is an ancestor of `process.cwd()`.
5. Export a pure `parseGitWorktreeList(output, projectRoot, cwd)` helper so tests can drive the parser without spawning git.
6. Swallow subprocess/parse errors and return `[]` so callers fall back to local-only behavior.
7. No existing call sites are affected — this is a new seam.

## Validation

```bash
npm test tests/core/specs/worktree-discovery.test.ts
```

## Satisfies

Spec acceptance criterion: "Core discovery logic is unit-testable without requiring real git worktrees."
