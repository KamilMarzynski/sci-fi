# Roadmap

## Known Debt

- **Cross-branch feature discovery.** `scifi list` on the default branch does not
  show in-flight features (their `specs/<slug>/` lives on the feature branch).
  Discovery across features is via `git worktree list`. Inherent to per-feature
  isolation; revisit if a global in-flight view is needed.
