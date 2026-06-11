# sf-continue

Work on a feature was put down — maybe mid-grill, maybe mid-build — and you are
picking it back up. Your job is orientation, not execution: read where the
feature actually is, name the next workflow step, and hand control to the skill
that owns it. You do the *least* work needed to point at the right next move.

You are a router. `sf-feature`, `sf-plan`, and `sf-implement` do the real work
and each resumes from its own partial state. You decide which one, and where it
should pick up.

## Flow

### 1. Identify the feature and enter its workspace

- `/sf-continue <slug>` — treat the argument as an exact feature slug.
- `/sf-continue <description>` or no argument — discover candidates from **both**
  `scifi list --json` (features whose specs are on the current checkout) **and**
  `git worktree list` (an in-flight feature lives on its own `feat/<slug>` branch
  and will *not* appear in `scifi list` run from the default checkout). Match by
  slug and title. If one obviously fits, name it; if several could, present them
  and **confirm the pick with the user**. Never guess silently.
- **Enter the feature's worktree before reading its state.** An in-flight
  feature's `docs/scifi/specs/<slug>/.scifi.json` exists only on its `feat/<slug>`
  branch — not in the default checkout. Run `git worktree list`; if
  `.worktrees/feat-<slug>` (branch `feat/<slug>`) exists, enter it and read state
  from there. Running `scifi status <slug>` from the default checkout would
  otherwise report `NOT_FOUND` for a feature that is merely on another branch.
- Conclude the feature does **not** exist only when *both* hold: no `feat/<slug>`
  worktree exists **and** `scifi status <slug>` returns `NOT_FOUND` from a
  checkout that would contain it (e.g. the default branch for a merged feature).
  Then say so and point the user at `sf-feature`. A `NOT_FOUND` while a matching
  worktree exists just means you are in the wrong checkout — enter the worktree
  and re-read; never route the user to start a new feature in that case.

### 2. Read the state

```
scifi status <slug> --json
```

Run this **from inside the feature's worktree** (entered in step 1). Read
`status`, the `artifacts` inventory (`artifacts.spec`, `artifacts.design`,
`artifacts.taskCount`), the per-task statuses in `tasks[]`, and `fixes[]` — each
fix carries its own `status`, so filter for the open ones. That single call
tells you everything you need to route. Do not start reading or editing the
spec/design yourself — the owning skill will. The `worktree`/`branch` fields
confirm the workspace you entered.

### 3. Route by lifecycle status

Map the state to the next step. The lifecycle is
`created → spec-ready → plan-ready → in-progress → done`.

| Status | What the inventory shows | Where it actually stands | Next move |
| --- | --- | --- | --- |
| `created` | `spec` missing | container made, spec never written | **`sf-feature`** — resume the grill and write `spec.md`. The container already exists, so skip its create step (`scifi spec` would `CONFLICT`); grill, write the spec, review, then `scifi spec-ready`. |
| `created` | `spec` present | spec drafted but never gated | **`sf-feature`** — finish it: run `sf-spec-review`, then `scifi spec-ready`. |
| `spec-ready` | no `design`, no tasks | spec gated, planning not begun | **`sf-plan`** — start planning. |
| `spec-ready` | some `design`/tasks | planning interrupted | **`sf-plan`** — it detects the partial state and resumes. |
| `plan-ready` | — | planned, build not begun | **`sf-implement`** — it runs `scifi start` and begins. |
| `in-progress` | tasks mixed (pending/in-progress/done) | build interrupted | **`sf-implement`** — it skips `done` tasks and resumes at the next runnable one. |
| `in-progress` | all tasks `done` | build finished, not closed out | **`sf-implement`**'s finish path — final `sf-handover` verification, then `scifi finish`. |
| `done` | open `fixes` | feature closed but a fix is open | **`sf-fix`** — resolve the open fix (it blocks `scifi finish`). |
| `done` | no open fixes | nothing to continue | Say so. For new scope use `sf-change`; for a defect use `sf-fix`. |

### 4. Hand off

Tell the user, in a sentence or two: where the feature stands, what the next
step is, and which skill owns it. Then invoke that skill.

**Pause where a human handoff is required.** Spec and planning sessions
(`sf-feature`, `sf-plan`) are interactive grills — the user drives them. Hand
control over and let them resume; do not autonomously grill on their behalf. The
build (`sf-implement`) resumes on its own. Where the next step is a human action
the tool cannot take (e.g. anything in `docs/scifi/HANDOVER.md`), name it and
stop rather than guessing.

## Hard rules

- Never route from anything but the live `scifi status` output — not memory, not
  the directory listing alone.
- Never treat a `NOT_FOUND` as "feature missing" until you have checked
  `git worktree list` for a `feat/<slug>` worktree and read status from inside
  it. An in-flight feature is invisible to `scifi status` from the default
  checkout — routing such a user to `sf-feature` would start a duplicate.
- Never re-create a container that already exists; a `created` feature resumes
  inside `sf-feature` without `scifi spec`.
- Never silently pick a feature when the match is ambiguous — confirm first.
- Never do the next step's deep work here — orient and hand off.
