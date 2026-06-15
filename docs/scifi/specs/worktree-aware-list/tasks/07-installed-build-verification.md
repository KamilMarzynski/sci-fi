---
id: TASK-007
slug: installed-build-verification
status: pending
depends-on: [TASK-003, TASK-004]
---

# Installed-build verification for worktree-aware commands

## Goal

Prove the packaged CLI behaves correctly from a fresh install when features live in linked worktrees.

## Tests first

- New `tests/e2e/installed-worktree-discovery.test.ts`
  - Builds and packs the package into `.testing/artifacts/`.
  - Creates a disposable git sandbox under `.testing/sandboxes/`.
  - Installs the packed tarball globally in the sandbox.
  - From the default branch, creates a feature locally and a linked worktree with a second feature.
  - Runs the installed `scifi list` and asserts both features appear with correct `location` values.
  - Runs the installed `scifi status <slug>` for the worktree-only feature and asserts `location: worktree:<path>`.
  - Cleans up `.testing/sandboxes/` and `.testing/artifacts/` on completion.

## Work

1. Copy the installed-build harness pattern from existing `tests/e2e/installed-*.test.ts` files.
2. Use `npm pack` to produce a tarball and `npm install -g <tarball>` inside the sandbox.
3. Use real `git worktree add` in the sandbox to create a feature worktree.
4. Create `.scifi.json` metadata in both the main checkout and the worktree using realistic fixtures.
5. Assert stdout and `--json` output for `scifi list` and `scifi status`.
6. Ensure cleanup runs even if assertions fail.

## Validation

```bash
npm test tests/e2e/installed-worktree-discovery.test.ts
```

## Satisfies

- "Installed-build verification, from a fresh package install, exercises `scifi list` and `scifi status <slug>` and asserts the `location` behavior defined in the acceptance criteria above."
