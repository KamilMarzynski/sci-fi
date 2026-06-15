---
id: TASK-004
slug: worktree-aware-status
status: pending
depends-on: [TASK-001]
---

# Make scifi status worktree-aware

## Goal

Allow `scifi status <slug>` to resolve a feature from a linked worktree when it is missing locally, and surface the `location` in both human and JSON output.

## Tests first

- `tests/core/specs/lifecycle.test.ts`
  - `resolveFeatureLifecycle` returns local lifecycle with `location: local` when `.scifi.json` exists locally.
  - With a fake provider returning a linked worktree, `resolveFeatureLifecycle` returns the worktree lifecycle and `location: worktree:<path>` when the slug is absent locally but present there.
  - Local copy wins when both local and worktree copies exist.
  - When the slug is absent everywhere, the local `inspectFeatureLifecycle` throws `NOT_FOUND` unchanged.
- `tests/cli/status.test.ts`
  - Create a temp git repo with a worktree-only feature and assert `scifi status <slug>` succeeds and prints the worktree path and `location`.
  - Assert `--json` output includes `location` for both local and worktree cases.

## Work

1. In `src/core/specs/lifecycle.ts`, add:
   ```ts
   export interface ResolvedFeatureLifecycle {
     lifecycle: FeatureLifecycle;
     location: 'local' | `worktree:${string}`;
   }

   export async function resolveFeatureLifecycle(
     projectRoot: string,
     slug: string,
     worktreeProvider?: WorktreeProvider,
   ): Promise<ResolvedFeatureLifecycle>;
   ```
2. Implement local-first lookup:
   - Try `inspectFeatureLifecycle(projectRoot, slug)`. On success return `{ lifecycle, location: 'local' }`.
   - On `NOT_FOUND`, ask `worktreeProvider.discover(projectRoot)`, exclude `isCurrent`, sort remaining by path, and try `inspectFeatureLifecycle(worktreePath, slug)` for each.
   - On success return `{ lifecycle, location: 'worktree:<path>' }`.
   - If none succeed, rethrow the original `NOT_FOUND`.
3. In `src/cli/commands/status.ts`, switch from `inspectFeatureLifecycle` to `resolveFeatureLifecycle` and wire `createGitWorktreeProvider()`.
4. Add `location` to the JSON data object and to the human output lines.
5. Preserve all existing artifact/task/fix output unchanged.

## Validation

```bash
npm test tests/core/specs/lifecycle.test.ts tests/cli/status.test.ts
```

## Satisfies

- "`scifi status <slug>` succeeds and reports from the worktree path when the feature is not present in the current checkout but exists in a linked `Worktree`."
- "`scifi status <slug>` still uses the current checkout when the feature exists there ... and reports `location: local`."
- "`scifi status <slug>` output for a worktree-fallback feature shows `location: worktree:<path>` and the metadata ... from that worktree."
- "When `scifi status <slug>` cannot find the feature ... it preserves the existing `NOT_FOUND` error response."
- "`scifi status <slug> --json` ... includes a `location` field."
