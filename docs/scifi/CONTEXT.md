# CONTEXT.md

> Project glossary. Every term used in specs must be defined here.
> If a term is missing during a spec session, define it and update this file.

## Terms

<!-- Template:
### TermName
**Definition:** One clear sentence.
**Distinct from:** Other terms it might be confused with.
**Used in:** Links to specs where it appears.
-->

### Harness
**Definition:** An AI coding tool that scifi can install its skills into — one of `claude-code`, `opencode`, `codex`, `cursor`, `github-copilot`.
**Distinct from:** Harness adapter (the code that performs the install); a "skill" (the unit being installed).
**Used in:** specs/multi-harness-init, specs/copilot-harness.

### github-copilot
**Definition:** The GitHub Copilot AI coding assistant, treated as a Harness for scifi skill installation. Installs to `.github/skills/`.
**Distinct from:** Harness adapter; a "skill".
**Used in:** specs/copilot-harness.

### Harness adapter
**Definition:** The code that writes the sf-* skills into a specific harness's on-disk layout (its `<base>/skills/<id>/SKILL.md` folder).
**Distinct from:** Harness (the tool itself); the shared skill-folder writer the adapters delegate to.
**Used in:** specs/multi-harness-init.

### Feature
**Definition:** A scifi-managed unit of work represented by a directory under `docs/scifi/specs/<slug>/` and tracked through the lifecycle states `created`, `spec-ready`, `plan-ready`, `in-progress`, `done`.
**Distinct from:** A git branch or worktree (those are implementation mechanisms); a task (a sub-item of a feature).
**Used in:** specs/worktree-aware-list.

### Feature metadata
**Definition:** The JSON file `docs/scifi/specs/<slug>/.scifi.json` that records a feature's slug, lifecycle status, title, branch, and worktree path.
**Distinct from:** The feature's spec or design documents.
**Used in:** specs/worktree-aware-list.

### Slug
**Definition:** A short, kebab-case identifier used as a feature or task folder name, e.g. `worktree-aware-list`.
**Distinct from:** A human-readable title; a branch name.
**Used in:** specs/worktree-aware-list.

### Open-fix count
**Definition:** The number of fixes under a feature whose status is `open`.
**Distinct from:** Total fixes (includes closed fixes).
**Used in:** specs/worktree-aware-list.

### Spec
**Definition:** The `spec.md` artifact inside a feature directory that defines the problem, scope, acceptance criteria, and architecture impact.
**Distinct from:** `design.md` (the plan artifact) and task files (implementation artifacts).
**Used in:** specs/worktree-aware-list.

### Worktree
**Definition:** A git worktree linked to the repository and used as the isolated workspace for a scifi feature, typically created at `.worktrees/feat-<slug>` and checked out on branch `feat/<slug>`.
**Distinct from:** The current checkout; a branch (a worktree is a working tree, not a ref).
**Used in:** specs/worktree-aware-list.

### Skill bodies
**Definition:** The agent instruction files located under `skills/<id>/body.md` that are shipped as part of the scifi package.
**Distinct from:** The skill manifests under `.claude/skills/<id>/SKILL.md` used by this development harness.
**Used in:** specs/worktree-aware-list.

### Location
**Definition:** A CLI output field indicating where scifi resolved a feature: `local` for the current checkout, or `worktree:<absolute-path>` for a linked git worktree.
**Distinct from:** The feature's recorded `worktreePath` metadata field.
**Used in:** specs/worktree-aware-list.

### Current checkout
**Definition:** The git working tree from which the scifi command is currently being invoked.
**Distinct from:** A linked `Worktree` used as a feature workspace.
**Used in:** specs/worktree-aware-list.
