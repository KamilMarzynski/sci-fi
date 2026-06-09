# Design: Replace ARCHITECTURE.md with a lazy ADR store

- **Date:** 2026-06-09
- **Status:** approved

## Problem / Why

scifi scaffolds `docs/scifi/ARCHITECTURE.md` and every flow skill reads it at
session start and is told to "ask to update it when structure changes." A single
living architecture doc is heavy to maintain, drifts from reality, and turns
every spec/plan/review into an exercise of confronting work against a document
that nobody keeps current. We want decisions captured the way good teams capture
them: as **Architecture Decision Records** — small, append-only, written only
when a decision is genuinely worth recording. Inspiration:
`mattpocock/skills` `grill-with-docs`.

## What changes (concept)

- `docs/scifi/ARCHITECTURE.md` is removed everywhere — scaffold, CLI, skills,
  templates, tests.
- Architecture knowledge lives in `docs/scifi/adr/` as numbered records
  `NNNN-slug.md`.
- The directory is **lazy**: `scifi init` does NOT create it. The first
  ADR-worthy decision creates `adr/` and the first record (`0001-...`).
- ADRs are authored **only** during spec (`sf-feature`) and planning
  (`sf-plan`) sessions, and **sparingly**.
- `CONTEXT.md` stays. It is the project's **ubiquitous language** — a glossary
  for canonical naming. It is NOT an architecture or structure document. All
  "glossary" checks are about naming consistency only, never a structural gate.

## ADR file shape

`docs/scifi/adr/0001-use-event-queue-between-ordering-and-billing.md`:

```markdown
# 0001: Use an event queue between ordering and billing

- Status: Accepted
- Date: 2026-06-09

## Context

What forces are at play — the problem, the constraints, the alternatives that
existed.

## Decision

The choice that was made, stated plainly.

## Consequences

What becomes easier, what becomes harder, what we are now committed to.
```

Numbering: zero-padded sequential (`0001`, `0002`, …). To allocate the next
number, list `docs/scifi/adr/` and take `max + 1`; if the dir does not exist,
start at `0001` and create it.

## When to write an ADR (the bar)

Write one only when **all three** hold (else skip):

1. **Difficult reversal** — meaningful cost to changing course later.
2. **Non-obvious rationale** — a future reader will question the choice.
3. **Genuine trade-offs** — real alternatives existed; one was chosen
   deliberately.

A routine, obvious, or easily-reversed choice gets no ADR.

## When to read ADRs

No fixed bootstrap read. During a spec or planning session, **grep**
`docs/scifi/adr/` for keywords relevant to the work in front of you — the same
instinct as grepping the codebase while grilling. Review the hits before
deciding something that would contradict a recorded decision.

ADRs are consulted **only** in spec and planning. Review skills do NOT read
ADRs (see below); the relevant decisions are already reflected in `spec.md` /
`design.md`, so reviews judge against those artifacts.

## Changes by surface

### Scaffold — `src/core/init/scaffold.ts`

- Delete `buildArchitectureDocument()`.
- Remove the `ARCHITECTURE.md` entry from `buildBootstrapDocuments()`.
- Do NOT add `adr/` to `buildScaffoldDirectories()` — it is created lazily by
  skills. (`.scifi`, `specs`, `bugs` stay.)

### CLI — `src/cli/commands/init.ts`

- `BOOTSTRAP_FILES`: drop `'ARCHITECTURE.md'` → `['EVALUATION.md', 'CONTEXT.md']`.
- "Next:" hint: change `read docs/scifi/CONTEXT.md and docs/scifi/ARCHITECTURE.md`
  to `read docs/scifi/CONTEXT.md`.

### Tests — `tests/core/init/scaffold.test.ts`

- Remove every `ARCHITECTURE.md` read/assert and the
  `expectedArchitectureDocument` constant.
- Add an assertion that `docs/scifi/ARCHITECTURE.md` is NOT written.
- Add an assertion that `docs/scifi/adr/` is NOT created by init (lazy).
- Keep `EVALUATION.md` / `CONTEXT.md` assertions; keep the rerun-preservation
  test (minus ARCHITECTURE.md).

### `sf-feature` (spec authoring)

- `body.md`:
  - "Long-term memory you must read" → read `CONTEXT.md` only (ubiquitous
    language). Replace the ARCHITECTURE.md read with: grep `docs/scifi/adr/` on
    demand during grilling for decisions relevant to this feature.
  - Replace "propose `CONTEXT.md` / `ARCHITECTURE.md` edit" with: define new
    domain terms in `CONTEXT.md` (naming), and — only when the 3-condition bar
    is met — write an ADR.
  - Add a short **Architecture Decision Records** section: the bar (3
    conditions), numbering, lazy dir, points at `ADR-TEMPLATE.md`.
- `SPEC-TEMPLATE.md`: `**ARCHITECTURE.md changes:**` → `**ADRs:**` (records
  written/affected, or "none"). `**New CONTEXT.md terms:**` stays.
- `DISPATCH-SPEC-REVIEW.md`: drop `docs/scifi/ARCHITECTURE.md` from the read
  list (review reads spec + CONTEXT).
- `manifest.ts` description: drop "Reads ARCHITECTURE.md. Asks to update it when
  work touches structure." → reflect ADR authoring.
- Ship `ADR-TEMPLATE.md` beside the skill.

### `sf-plan` (planning)

- `body.md`:
  - "Long-term memory you must read" → `spec.md` + `CONTEXT.md`; grep `adr/`
    on demand. Drop ARCHITECTURE.md.
  - "Design for depth": the line "Confront the design against `ARCHITECTURE.md`"
    → confront against the spec, the codebase, and relevant ADRs (grep).
  - Replace "propose `CONTEXT.md` / `ARCHITECTURE.md` edit" with: define new
    terms in `CONTEXT.md`; write an ADR only when the 3-condition bar is met.
  - Add the **Architecture Decision Records** section (same as sf-feature).
- `DESIGN-TEMPLATE.md`: `**ARCHITECTURE.md changes:**` → `**ADRs:**`.
- `DISPATCH-PLAN-REVIEW.md`: drop `docs/scifi/ARCHITECTURE.md` from the read
  list.
- `manifest.ts` description: drop "Reads ARCHITECTURE.md, asks to update if
  needed." → reflect ADR authoring.
- Ship `ADR-TEMPLATE.md` beside the skill.

### `sf-spec-review`

- "What to read": drop `ARCHITECTURE.md`; read spec + `CONTEXT.md`.
- Drop the "**Architecture conflict**" bullet (the ARCHITECTURE.md contradiction
  check). The "touches structure without saying so in Architecture & Context
  impact" idea is folded into reading the spec's own impact section.
- Keep the glossary bullet, framed as naming consistency (ubiquitous language).
- Calibration text mentioning "architecture conflict" → removed.

### `sf-plan-review`

- "What to read": drop `ARCHITECTURE.md`.
- Rewrite the "**Architecture fit**" bullet to be design-anchored only: new
  seams must be declared in the design's "Architecture & context impact", not
  introduced silently. Remove the "contradict ARCHITECTURE.md / planned
  direction" clause.
- Calibration: "an architecture conflict" → "an undeclared new seam".
- Glossary bullet: naming consistency framing.

### `sf-code-review`

- "What to read": drop `ARCHITECTURE.md`; keep design, task, `CONTEXT.md`.
- Rewrite the "**Architecture fit**" bullet to design-anchored only: new seams
  (boundary, dependency, communication pattern) must be declared in `design.md`,
  not introduced silently. Remove the ARCHITECTURE.md contradiction clause.
- Calibration: "an architecture conflict" → "an undeclared new seam".
- Glossary bullet: naming-consistency framing.
- `manifest.ts` description: "Quality review of changes against ARCHITECTURE.md
  and AGENTS.md rules." → against design/spec and AGENTS.md rules.

### `sf-implement`

- `body.md`: "Long-term memory you must read" — drop `ARCHITECTURE.md`; keep
  `CONTEXT.md`. Dispatch step "give it the reference paths (spec, design,
  architecture, context)" → drop "architecture".
- `DISPATCH-IMPLEMENTER.md`: reference list `docs/scifi/ARCHITECTURE.md,
  docs/scifi/CONTEXT.md — system + glossary.` → `docs/scifi/CONTEXT.md —
  glossary (ubiquitous language).`
- `DISPATCH-CODE-REVIEW.md`: drop `docs/scifi/ARCHITECTURE.md and`.
- `DISPATCH-FINAL-REVIEW.md`: drop `docs/scifi/ARCHITECTURE.md and`.

### `ROADMAP.md`

- Update the scaffold-docs line (currently mentions `ARCHITECTURE.md` added) to
  reflect: `ARCHITECTURE.md` removed; decisions captured lazily in
  `docs/scifi/adr/`.

## Out of scope

- No CLI command to scaffold or number ADRs — creation is done by skills with
  plain file writes + an `ls` to pick the next number. (Could be a later
  `scifi adr` command; not now.)
- No migration of existing `ARCHITECTURE.md` content — repos that already ran
  the old init keep their file; we just stop generating and reading it.
- `docs/superpowers/*` historical plan/spec files are left untouched as a
  record of the prior design.

## Acceptance criteria

- [ ] `scifi init` writes `EVALUATION.md` + `CONTEXT.md`, NOT `ARCHITECTURE.md`,
      and does NOT create `docs/scifi/adr/`.
- [ ] No skill body, manifest, template, or dispatch file references
      `ARCHITECTURE.md`.
- [ ] `sf-feature` and `sf-plan` bodies contain the ADR bar (3 conditions),
      numbering rule, lazy-dir rule, and ship `ADR-TEMPLATE.md`.
- [ ] SPEC-TEMPLATE and DESIGN-TEMPLATE have an `ADRs:` field, no
      `ARCHITECTURE.md changes:` field.
- [ ] Review skills do not read or check against ADRs; their architecture
      bullets are design-anchored; glossary bullets are framed as naming
      consistency (ubiquitous language).
- [ ] `sf-implement` and its dispatch files reference `CONTEXT.md` only, not
      `ARCHITECTURE.md`.
- [ ] `tests/core/init/scaffold.test.ts` asserts ARCHITECTURE.md is not written
      and adr/ is not created; suite passes.
- [ ] `ROADMAP.md` scaffold-docs line updated.

## Edge cases & open questions

- **Edge case:** allocating ADR number when `adr/` is absent → start at `0001`
  and create the dir in the same write.
- **Edge case:** concurrent sessions could collide on a number; acceptable —
  single-user flow, and a collision is a visible filename clash, easy to fix.
- **Open questions:** none.
