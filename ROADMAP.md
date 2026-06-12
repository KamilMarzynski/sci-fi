# Roadmap

## Known Debt

- **Cross-branch feature discovery.** `scifi list` on the default branch does not
  show in-flight features (their `specs/<slug>/` lives on the feature branch).
  Discovery across features is via `git worktree list`. Inherent to per-feature
  isolation; revisit if a global in-flight view is needed. A registry on the
  default checkout (or a CLI that scans `git worktree list` itself) would also
  delete the "`NOT_FOUND` may mean wrong checkout" caveat paragraphs that
  `sf-continue`, `sf-change`, and `sf-fix` each carry.
- **Duplicated skill prose.** The ADR read/write block (+ `ADR-TEMPLATE.md`) is
  duplicated verbatim in `sf-feature` and `sf-plan`, and the worktree/`NOT_FOUND`
  feature-discovery block is near-verbatim in `sf-continue`, `sf-change`, and
  `sf-fix`. Installed skills must stay self-contained, but the source could share
  one copy injected at build time (the catalog already assembles bundles) so an
  edit cannot drift the copies apart.
