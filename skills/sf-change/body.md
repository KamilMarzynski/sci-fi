# sf-change

The scope of ONE existing feature has changed. Your job is to absorb that
change cleanly: figure out where the feature currently sits, work out how deep
the change cuts, update the affected artifacts under the same grilling and
review gates that produced them, and reset the feature's lifecycle status so it
never sits *ahead* of the artifacts that back it.

You do not re-invent the pipeline. `sf-feature`, `sf-plan`, and `sf-implement`
already own spec creation, planning, and implementation — each with its own
grill and its own review gate. Your job is to decide **how far back the change
rolls the feature**, reset the status to that point, and re-enter the pipeline
there so the right gate runs again. A change that touches the *what* is not the
same as one that touches the *how*; getting that judgement right is the work.

## The Iron Law

```
IDENTIFY → ASSESS STATE → SCOPE THE CHANGE → DECIDE BLAST RADIUS →
RESET STATUS → RE-ENTER THE PIPELINE.
NEVER LET STATUS RUN AHEAD OF THE ARTIFACTS.
```

## Flow

### 1. Identify the feature

The change must attach to one feature. Resolve it before anything else.

- `/sf-change <slug>` — treat the argument as an exact feature slug. Confirm it
  exists with `scifi status <slug>`.
- `/sf-change <description>` — you were given prose, not a slug. Run
  `scifi list --json` and match candidates by slug and title. Present your best
  match (or the candidates, if ambiguous) and **confirm the pick with the
  user**. Never guess silently.
- No feature matches — stop. If this is genuinely new work, point the user at
  `sf-feature`. If it is a defect rather than a scope change, point them at
  `sf-fix`.

### 2. Assess current state

Read where the feature is before touching anything:

```
scifi status <slug> --json
```

Read the `status`, the artifact inventory (`spec`, `design`, `taskCount`), the
per-task statuses, and any open fixes. Then read the artifacts themselves —
`<path>/spec.md`, `<path>/design.md`, the task files under `<path>/tasks/` — and
grep `docs/scifi/adr/` for decisions touching the area. `<path>` is
`docs/scifi/specs/<slug>/`. You cannot scope a change without knowing the
current contract.

### 3. Scope the change (grill it)

Interrogate the change the same way `sf-feature` interrogates a new idea — one
question at a time, concrete either/or where possible. Drive toward:

- **What actually changes** — a requirement, an acceptance criterion, something
  moving in or out of scope, or only an internal mechanism.
- **Why now**, and what the change must *not* break.
- **Confront it against the existing artifacts.** Does it contradict the spec's
  stated scope? A recorded ADR? The agreed design? Surface the conflict; do not
  paper over it.

You are ready to act when you can state, in one sentence, exactly what changes
and which artifact owns it.

### 4. Decide the blast radius

Classify the change by the deepest artifact it invalidates. This decides how far
back the feature rolls.

| The change touches… | Deepest artifact | Roll back to | Re-enter via |
| --- | --- | --- | --- |
| The **what** — a requirement, acceptance criterion, in/out-of-scope line | `spec.md` | `spec-ready` | `sf-feature`'s grill + `sf-spec-review`, then `sf-plan`, then `sf-implement` |
| The **how** — module shape, seams, task breakdown; spec still holds | `design.md` / tasks | `plan-ready` | `sf-plan`'s grill + `sf-plan-review`, then `sf-implement` |
| A single in-flight task, within the current design | one task file | stay | `sf-implement` (or finish the task in place) |

When in doubt, roll back further, not less. A spec change that you treat as a
mere task tweak leaves the design and code quietly contradicting the contract —
exactly the failure this skill exists to prevent.

### 5. Reset the status

Lower the lifecycle status to the rollback point from step 4, using the CLI
levers — never by hand-editing metadata:

- **Spec-level** → edit `spec.md` first (or re-enter `sf-feature`'s grill for
  the affected sections), then `scifi spec-ready <slug>`. This re-anchors the
  feature at the spec stage; design, tasks, and code are now downstream of a
  changed contract and must be brought back in line.
- **Design-level** → update `design.md` and the task files, then
  `scifi plan-ready <slug>`.
- **Task-level** → no status change. `in-progress` stays `in-progress`.

Note the one-way gate: `in-progress` is only reachable *from* `plan-ready` via
`scifi start <slug>`. So a feature you rolled back to `spec-ready` climbs back
the normal way — `spec-ready → plan-ready → in-progress` — as each gate passes.
You do not get to jump straight back to where it was.

**If the feature was `done`,** a spec- or design-level change reopens it: reset
the status as above and the feature re-enters the pipeline. Do not leave a `done`
feature whose contract has changed.

### 6. Re-enter the pipeline

Hand control to the owning skill for the rollback point — that is where the
grill and the review gate live:

- Rolled to `spec-ready` → run `sf-feature` to settle the changed spec under
  `sf-spec-review`, then `sf-plan`, then `sf-implement`. Each gate re-runs.
- Rolled to `plan-ready` → run `sf-plan` to settle the changed design and tasks
  under `sf-plan-review`, then `sf-implement`.
- Stayed `in-progress` → run `sf-implement`; it resumes from the next runnable
  task and picks up the added or removed task files.

Adding or removing a task means adding or deleting a file under `<path>/tasks/`
(`sf-plan` owns the task template and the decomposition rules — re-enter it
rather than hand-rolling task files for anything beyond a trivial edit). The CLI
tracks task *status* (`scifi task start|done`), not task creation.

## When you are stuck

| Problem | Move |
| --- | --- |
| Unsure if it's a spec or design change | Ask: does an *acceptance criterion* move? Yes → spec. No → design. |
| Change contradicts a recorded ADR | Surface it. The decision may need revisiting before the change lands. |
| Feature is `done` and change is large | Reopen via `spec-ready`; treat it as a near-fresh pass through the pipeline. |
| Change turns out to be a defect, not new scope | Stop. Route to `sf-fix`. |
| Change is really a brand-new feature | Stop. Route to `sf-feature`; don't overload this one. |

## Done

The change is absorbed when:

- the target feature is identified and its current state read,
- the change is scoped to exactly the artifact it invalidates,
- that artifact is updated under its own grill and review gate,
- the lifecycle status is reset to match — never ahead of — the artifacts,
- and the feature has re-entered the pipeline at the rollback point.

## Hard rules

- Never change scope silently — grill it and confront it against the artifacts.
- Never lower a feature past `spec-ready`/`plan-ready` without re-running that
  stage's review gate.
- Never leave the status ahead of the artifacts: a changed spec means the
  feature is no longer `done`.
- Never hand-edit lifecycle metadata — use `scifi spec-ready` / `plan-ready`.
- Never absorb a defect or a new feature here — route to `sf-fix` / `sf-feature`.
