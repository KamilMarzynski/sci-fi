# sf-plan

You run a technical planning session for ONE feature whose spec is already
spec-ready. The session ends with a written `design.md`, a set of task files,
and the feature marked plan-ready. This is planning only — no implementation.

Where `sf-feature` grilled *what* to build, you grill *how* to build it: the
module shape, the seams, the order of work. Same hard, friendly interrogation —
now against the codebase itself.

## Long-term memory

Before planning, read:

- `<path>/spec.md` — the approved spec. This is the contract you plan against.
- `docs/scifi/CONTEXT.md` — the project's ubiquitous language (canonical
  glossary of domain terms).

`<path>` is the feature directory (`docs/scifi/specs/<slug>/`). When the design
introduces a new domain term, define it in `CONTEXT.md` and apply the edit live
once the user approves. For prior architectural decisions, grep
`docs/scifi/adr/` on demand — see "Architecture Decision Records" below.

## Architecture Decision Records

Decisions live in `docs/scifi/adr/` as numbered records `NNNN-slug.md`. The
directory is lazy — it does not exist until the first record.

- **Read on demand.** When the design touches an area that may already carry a
  recorded decision, grep `docs/scifi/adr/` for relevant keywords — the same
  instinct as walking the code before asking. Do not contradict a recorded
  decision without surfacing it to the user.
- **Write sparingly.** Record an ADR only when ALL THREE hold:
  1. Difficult reversal — meaningful cost to changing course later.
  2. Non-obvious rationale — a future reader will question the choice.
  3. Genuine trade-offs — real alternatives existed; one was chosen deliberately.
  A routine, obvious, or easily-reversed choice gets no ADR.
- **Numbering.** Run `ls docs/scifi/adr/` and take `max + 1`, zero-padded (e.g.
  `0007`). If the directory is absent, start at `0001` and create it. Copy
  `ADR-TEMPLATE.md` (ships beside this skill) into the new file and fill it.

## Design for depth

Your goal is **deep modules**: a lot of behavior behind a narrow interface.
Push back on shallow ones, where the interface is as complex as what it hides.
Keep this lens through the whole session:

- **Module** — any unit with an interface and an implementation.
- **Interface** — everything a caller must know: types, invariants, errors,
  ordering, config. Keep it small; hide the rest.
- **Depth** — behavior per unit of interface. High is good.
- **Seam** — where an interface lives; the point you can swap behavior.
- **Locality** — change, bugs, and knowledge concentrated in one place.
- **Deletion test** — would deleting this module *concentrate* complexity
  (it earns its keep) or just *scatter* it (it is shallow glue)?

Prefer fewer, deeper modules over many shallow ones. Distrust a "utils" grab
bag, a pure function extracted only so a test can reach it, or a class that
just forwards calls. Confront the design against the codebase and relevant ADRs
(grep `docs/scifi/adr/`): does it fit the existing seams, or does it quietly cut
new ones?

## Flow

### 1. Open the planning session

```
scifi plan <slug> --json
```

Read the result:

- `ready-to-plan` — fresh start, no design or tasks yet. Begin planning.
- `in-progress` — partial design/tasks already exist. Read them; continue from
  where they stop, or rewrite if the approach changed. Ask the user.
- `already-planned` — the feature is past spec-ready. Confirm with the user
  whether to refine the existing plan or start over before touching anything.
- If it errors `PRECONDITION_FAILED`, the spec is not ready — stop and tell the
  user to finish `sf-feature` first.

### 2. Grill the design (this is the real work)

Interrogate until you can write a design with no hand-waving. One question at a
time, concrete either/or where possible.

- Walk the relevant code first — answer from the codebase before asking.
- Drive toward: the module breakdown, each module's interface, where the seams
  are, what data flows across them, the failure modes, and what stays out.
- Apply the depth lens above to every proposed module. Name shallow modules and
  propose deeper alternatives.
- Confront the design against the spec's acceptance criteria and any relevant
  ADRs. Every criterion must be satisfiable by the design.
- When a new domain term appears, propose the `CONTEXT.md` edit and apply it
  once the user agrees. When planning settles a hard, non-obvious architectural
  decision, record an ADR (see above).

You are convinced when every section of the design template has a real answer
and every acceptance criterion maps to part of the design.

### 3. Write the design

- Copy `DESIGN-TEMPLATE.md` (ships beside this skill) into `<path>/design.md`
  and fill every section from the grilling.
- No `TBD` / `TODO`. Unresolved items go under "Open questions", not scattered
  as placeholders.

### 4. Decompose into tasks

Break the design into task files under `<path>/tasks/`, one file per task,
using `TASK-TEMPLATE.md` (ships beside this skill).

- **Test-first.** Each task delivers a vertical slice and names the tests that
  prove it. Implementation without a failing test first is not a task.
- **Phase order** via `depends-on` (there is no phase field — ordering is the
  dependency graph; independent tasks run in parallel):
  1. contracts / scaffolding — interfaces, types, seams.
  2. core behavior — the deep modules.
  3. edge cases — error states, boundaries.
  4. hardening — integration, observability, docs.
- Each task: a single clear goal, its `depends-on`, a **validation step**
  (the command or observable outcome that proves it done), and a link to the
  spec acceptance criterion it serves.
- Every in-scope acceptance criterion must be covered by at least one task.
- Frontmatter is exactly: `id`, `slug`, `status: pending`, `depends-on: []`.
  Filename is `<task-slug>.md`.

### 5. Review loop (gate)

- Dispatch the review subagent using `DISPATCH-PLAN-REVIEW.md` (ships beside
  this skill), filling in the feature path.
- Process its report with the `sf-receiving-review` skill, passing **review
  type: plan**. That skill governs how you act on the findings.
- Re-dispatch until the verdict is **Pass** or **With fixes**; a **Fail**
  re-loops. On **With fixes**, address the Minor items (or defer them with the
  user's ok) before finalizing. Do not skip this.

### 6. Finalize

- Only after the review passes, run:

  ```
  scifi plan-ready <slug> --json
  ```

  - This validates that `<path>/design.md` and at least one task file exist,
    and transitions the feature `spec-ready → plan-ready`.
  - If it errors `PRECONDITION_FAILED`, an artifact is missing or misplaced —
    write it under `<path>` and retry.
- This is the end of planning. Implementation happens later via `sf-implement`.

## Hard rules

- Never run `scifi plan-ready` before `sf-plan-review` passes.
- Never write `design.md` while any template section is unanswered.
- Never leave an in-scope acceptance criterion without a task.
- Never invent project facts — read the code and docs, or ask.
