# Roadmap

## Known Debt

- **Feature-ID collision across parallel branches.** `FEAT-NNNN` is derived from
  the count of `specs/` dirs on the current branch, so two features branched from
  the same default branch can compute the same next id until merged. The slug is
  the real key, so this is cosmetic. Revisit if ids ever become load-bearing.
- **Cross-branch feature discovery.** `scifi list` on the default branch does not
  show in-flight features (their `specs/<slug>/` lives on the feature branch).
  Discovery across features is via `git worktree list`. Inherent to per-feature
  isolation; revisit if a global in-flight view is needed.
