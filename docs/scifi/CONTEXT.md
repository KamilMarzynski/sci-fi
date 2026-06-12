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
