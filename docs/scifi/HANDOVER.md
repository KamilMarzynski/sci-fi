# Handover: worktree-aware-list

## Final verification

Run the full automated suite and the installed-build e2e test for this feature:

```bash
npm run build
npm test
npm run check
npm test tests/e2e/installed-worktree-discovery.test.ts
```

All must pass.

## Manual smoke test

From a temporary git repository with the installed build:

1. On the default branch, create a scifi feature: `scifi spec local-feature --title "Local feature"`.
2. Add a linked worktree on a feature branch: `git worktree add -b feat/other .worktrees/feat-other main`.
3. Inside the worktree, create another feature: `scifi spec other-feature --title "Other feature"`.
4. Return to the default branch and run `scifi list --json`. Both features must appear; `local-feature` with `location: local`, `other-feature` with `location: worktree:<absolute-path>`.
5. Run `scifi status other-feature --json`. It must succeed and include `location: worktree:<absolute-path>` plus the real metadata from the worktree.
6. Run `scifi status local-feature --json`. It must report `location: local`.
