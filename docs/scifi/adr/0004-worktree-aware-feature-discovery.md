# 0004: Worktree-aware feature discovery

- Status: Accepted
- Date: 2026-06-15

## Context

scifi stores every feature under `docs/scifi/specs/<slug>/`. Because in-flight features live on dedicated `feat/<slug>` branches in git worktrees, the default branch (e.g. `main`) only sees features that have already been merged back. Running `scifi list` from `main` therefore reports an incomplete world, and `scifi status <slug>` returns `NOT_FOUND` for any in-flight feature. Agents then have to cross-check `git worktree list` manually, and the skill bodies for `sf-change`, `sf-fix`, and `sf-continue` carry warnings that `NOT_FOUND` may simply mean "wrong checkout".

We needed to decide how `scifi list` and `scifi status <slug>` should discover features that are not present in the current checkout.

Alternatives considered:

1. **Configured worktree base path.** Add a `worktreeBase` setting (default `.worktrees/`) to `scifi.json` and scan subdirectories. This matches the current convention but breaks when users put worktrees elsewhere and requires maintaining another config value.
2. **Git-native discovery.** Enumerate attached worktrees via `git worktree list --porcelain` and scan `docs/scifi/specs/` inside each. This works with any worktree layout, requires no config, and stays aligned with git's own view of the repository.

We also needed precedence rules when the same feature slug appears in more than one place:

- The current checkout must win over any worktree, so a merged feature shown on `main` is not shadowed by an older worktree copy.
- When the same slug exists in multiple linked worktrees but not locally, the result must be deterministic. A lexicographic sort on the absolute worktree-path root is simple, stable, and easy to test.

## Decision

Use git-native worktree discovery. `scifi list` and `scifi status <slug>` enumerate linked worktrees through `git worktree list --porcelain`, normalize the emitted paths to absolute paths, and treat each worktree root as a secondary source of `docs/scifi/specs/<slug>/.scifi.json`. The current checkout's own entry in the git worktree list is identified as the worktree whose root is an ancestor of the current working directory and is excluded from fallback sources. Precedence is:

1. Current checkout.
2. Linked worktrees, tie-broken by lexicographically smallest absolute worktree-path root.

A `location` field is added to command output: `local` when the feature is taken from the current checkout, `worktree:<absolute-path>` when taken from a linked worktree.

## Consequences

- From any checkout, agents see a global feature list without manually running `git worktree list`.
- The "NOT_FOUND means wrong checkout" caveats in `sf-change`, `sf-fix`, and `sf-continue` can be removed; the skills can instead direct the user to the worktree shown in `location`.
- No new configuration is required; discovery follows git's own worktree bookkeeping.
- Core discovery logic is isolated behind an injectable adapter, keeping unit tests deterministic.
- The tool degrades gracefully outside a git repository or when git is unavailable: behavior falls back to local-only with no error.
