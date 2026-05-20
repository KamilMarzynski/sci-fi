# Roadmap

## Planned Sub-Projects

1. Bootstrap CLI
   Production-ready TypeScript CLI scaffold, package shape, config, base folders, and `specflow init` foundation.

2. Spec Lifecycle
   `specflow spec`, feature folder generation, IDs, and spec/plan/tasks templates.

3. Bug Lifecycle
   `specflow bug`, standalone vs spec-linked bugs, fuzzy lookup, and bug templates.

4. Agent Install Targets
   Generated integration files for Claude Code, OpenCode, Codex, and fallback `AGENTS.md` behavior.

5. Validation and Upgrade
   `specflow validate`, schema/frontmatter checks, CI-friendly exits, and `specflow update`.

6. Polish
   README, onboarding flow, packaging refinements, and broader test coverage.

## Current State

`Bootstrap CLI` is in place:

- TypeScript/Commander package scaffold is working.
- `specflow init` scaffolds the baseline repository structure.
- `.testing/` is the standard installed-build verification workspace.
- Installed-build end-to-end coverage exists for `specflow init`.

## Next Focus

Next sub-project: `Spec Lifecycle`
