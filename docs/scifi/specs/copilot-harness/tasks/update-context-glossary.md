---
id: T5
slug: update-context-glossary
status: done
depends-on: []
---

# Update CONTEXT.md with github-copilot term definition

## Goal

Add the `github-copilot` term to the project glossary so all specs and designs use consistent language.

## Tests first

No automated test required — this is a documentation change. Verification is manual inspection of `docs/scifi/CONTEXT.md`.

## Work

1. `docs/scifi/CONTEXT.md`:
   - Add the `github-copilot` term under the Terms section, following the existing template:
     - **Definition:** The GitHub Copilot AI coding assistant, treated as a Harness for scifi skill installation. Installs to `.github/skills/`.
     - **Distinct from:** Harness adapter; a "skill".
     - **Used in:** specs/copilot-harness.
   - Update the **Harness** term definition to include `github-copilot` in the list of examples.

## Validation

Inspect `docs/scifi/CONTEXT.md` to confirm:
- `github-copilot` term exists with correct definition.
- `Harness` term lists `github-copilot` among examples.

## Satisfies

- `docs/scifi/CONTEXT.md` includes the `github-copilot` term definition under the Terms section
