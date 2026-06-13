---
name: sf-implement
description: Orchestrate implementation of a plan-ready feature. Dispatches one
  TDD subagent per task in dependency order, gates each on code review, then
  runs handover (sf-handover verification) before finish.
argument-hint: "[feature-slug]"
---
# sf-implement

You orchestrate the implementation of ONE plan-ready feature. You do not write
the feature's code yourself, and you do not review it. You dispatch a fresh
subagent per task; that implementer builds the task and runs its own code-review
loop (it dispatches the reviewer, acts on the findings, re-reviews until clear),
returning to you only once review has passed. You drive the whole feature to
done and, at the end, dispatch handover. Your context stays clean for
coordination; each subagent gets exactly the context it needs and nothing from
your history.

Where `sf-plan` produced `design.md` and a set of tasks, you execute them.

## Long-term memory you must read

Before dispatching anything, read enough to brief subagents precisely:

- `<path>/spec.md` — the contract the feature must satisfy.
- `<path>/design.md` — the technical design: modules, seams, test strategy.
- `<path>/tasks/*.md` — the tasks you will dispatch.
- `docs/scifi/CONTEXT.md` — the ubiquitous-language glossary; referenced by
  subagents, so know where it is to point them at it.

`<path>` is the feature directory (`docs/scifi/specs/<slug>/`).

## Flow

### 1. Start the feature

```
scifi start <slug> --json
```

Transitions `plan-ready → in-progress`. Starting a feature that is *already*
`in-progress` is an idempotent no-op, so a resumed run (e.g. routed here by
`sf-continue`) passes straight through. If it errors `PRECONDITION_FAILED`, the
feature has not been planned yet — stop and tell the user to finish `sf-plan`
first.

**Record the base commit.** Capture the current `HEAD` SHA now (`git rev-parse
HEAD`) — call it `{BASE}`. It is the point the feature's work branches from, so
`{BASE}..HEAD` is the whole-feature range you hand to handover later. On a
resumed run, `{BASE}` is the last commit *before* this feature's first task
commit; recover it from the git log if you no longer have it. The feature's
branch and worktree already exist (created by `sf-feature`); confirm you are
inside it — `scifi status <slug> --json` reports the `worktree` path. The CLI
does not run git; commits are yours and the implementers'.

**Bootstrap the harness and prove it runs — before any task is dispatched.**
A fresh worktree (created by `sf-feature`) has no installed dependencies, so the
project's required checks — including any mandatory verification flow the repo's
testing docs define (e.g. a `TESTING.md`) — cannot run in it yet. If you dispatch tasks against a
tree where the verification command cannot run, the mandatory gate is silently
off and every task ships unverified. So, from inside the worktree:

1. Install dependencies the way the repo expects (e.g. `npm install`).
2. Run the project's verification harness once as a smoke check — the test suite
   and, for any CLI/packaging repo, whatever installed-build flow its testing
   docs require. Confirm it actually executes and reports green.

This is a **gate, not a courtesy**. If install fails, or the verification command
will not run for any reason, **STOP and surface it to the user as BLOCKED** — do
not label it a "pre-existing env issue", do not work around it, do not dispatch a
single task. A verification harness that cannot run is the one thing that must
never be passed silently. Only once the harness runs green do you proceed. On a
resumed run, re-prove the harness here too — the worktree may have been recreated
or its dependencies dropped since the last task.

### 2. Build the task order

```
scifi task list <slug> --json
```

Each task reports `{ slug, status, dependsOn }`. Use `depends-on` to order the
work: a task is **runnable** only when every task it depends on is `done`.

Execution is **serial** — one implementer subagent at a time, even when two
tasks have no dependency between them. `depends-on` controls *order*, not
concurrency; dispatching implementers in parallel against one working tree
causes file conflicts. Walk the tasks in dependency order, skipping any already
`done` (so a resumed run picks up where it stopped).

### 3. Per task: dispatch → done

The implementer owns its own review loop: it dispatches a fresh code-review
subagent, acts on the findings in its own warm context, and re-reviews until the
verdict clears — it reports back to you only once review has passed. You dispatch
implementers; implementers dispatch reviewers; only you dispatch handover.

For each runnable task, in order:

1. **Mark in-progress.**

   ```
   scifi task start <slug> <task>
   ```

2. **Dispatch the implementer.** Use `DISPATCH-IMPLEMENTER.md` (ships beside this
   skill). Inline the full task body into the prompt — do **not** make the
   subagent hunt for it — and give it the reference paths (spec, design, context)
   and the `DISPATCH-CODE-REVIEW.md` template it will use to dispatch its
   reviewer. The implementer loads `sf-tdd`, builds the task test-first, then runs
   the code-review gate itself before returning.

3. **Handle the implementer's status:**
   - `DONE` — built, tests green, **and its code-review loop cleared** (Pass, or
     With fixes with only Minor handled). Its report carries the final reviewer
     verdict and the `Commit:` range. Proceed to mark done.
   - `DONE_WITH_CONCERNS` — done and review-clear, but it flags doubts.
     Correctness/scope concerns: resolve (re-dispatch) before marking done.
     Observations: note and proceed.
   - `REVIEW_UNAVAILABLE` — the implementer could not dispatch a reviewer (the
     harness does not let a subagent spawn one). Fall back to running the gate
     yourself: dispatch the code-review subagent with `DISPATCH-CODE-REVIEW.md`
     (fill `{COMMIT_RANGE}` from the implementer's `Commit:` line, plus
     `{FEATURE_PATH}` and `{TASK_SLUG}`), then route its findings to a **fresh fix
     subagent** with the findings and commit range inlined (you cannot resume the
     original implementer). Re-review until the verdict clears, same bar as below.
   - `NEEDS_CONTEXT` — provide the missing context, re-dispatch.
   - `BLOCKED` — assess: more context (re-dispatch), too large (split the task),
     or the plan itself is wrong (escalate to the user). Never blindly re-run
     the same dispatch unchanged.

   **The review bar (whoever runs the gate):** re-review until **Pass** or a
   clean **With fixes**; a **Fail** re-loops. **Critical and Important findings
   are both must-fix** — the task is not done while either is open, whatever
   verdict word the reviewer used (a "With fixes" listing an Important is a
   mislabel; the findings govern, so it re-loops like a Fail). Only **Minor**
   items may be addressed-or-deferred (defer with the user's ok). Never review a
   task yourself — a fresh subagent reviews, never the orchestrator.

4. **Mark done.**

   ```
   scifi task done <slug> <task>
   ```

   This unlocks dependents. Move to the next runnable task.

Run continuously — do not stop to ask "should I continue?" between tasks. Stop
only for a `BLOCKED` you cannot resolve, a genuine ambiguity, or all tasks done.

### 4. Handover

Once all tasks are `done`:

- Dispatch the handover subagent with `DISPATCH-HANDOVER.md`, which loads the
  `sf-handover` skill. Fill `{COMMIT_RANGE}` with `{BASE}..HEAD` — the base
  commit you recorded in step 1 through the current `HEAD`, i.e. the whole
  feature's work. It verifies the whole feature against `spec.md` and `design.md`
  and runs a final quality check over the complete change — there is no separate
  whole-feature code review; the per-task reviews already cleared each task.
- Route every finding back to a fix subagent; the orchestrator coordinates but
  does not fix substantial issues itself. Only trivially small fixes are yours.
  Handover's verdict is **Pass** or **Fail** (no "With fixes") — re-dispatch
  until it is **Pass**.
- When handover passes, move to finish (step 5). Do **not** run the `HANDOVER.md`
  finishing actions yet — those run after finish (step 6), so the
  `in-progress → done` transition is committed into the branch the PR is opened
  from.

**Settle untracked workflow artifacts before finishing — not after.** The
pipeline produces artifacts (this feature's `docs/scifi/specs/<slug>/`, any new
ADRs, `CONTEXT.md` edits) that may be **untracked on the base branch**. Before
`scifi finish` run `git status` and look for workflow files that are new or
untracked. If any are, this is a decision the user must make *now*, not a
surprise discovered after the feature is closed: surface the list and ask
whether each belongs committed with the feature, in a separate commit, or
git-ignored. Do not silently commit them and do not leave them dangling.
Resolve it, then proceed to finish.

### 5. Finish

```
scifi finish <slug> --json
```

Transitions `in-progress → done`, writing `status: "done"` into the feature's
`docs/scifi/specs/<slug>/.scifi.json`. Run this **before** the `HANDOVER.md`
finishing actions — and **commit the resulting `.scifi.json` change** — so the
`done` state lands in the branch the PR is opened from. Otherwise the feature
merges to the default branch still reading `in-progress`.

### 6. Run HANDOVER.md

After finish, if `docs/scifi/HANDOVER.md` exists, run the finishing actions it
defines, in the order it gives. These run here at the orchestrator's top level
(not inside a subagent) so irreversible or visible actions stay visible. If the
file is absent, the implement stage ends at finish.

## Hard rules

- Never dispatch a task before the verification harness is installed and proven
  to run green in the worktree (step 1). A harness that will not run is BLOCKED,
  never a workaround.
- Never dispatch two implementer subagents at once — serial only.
- Never mark a task done before its code review clears (**Pass**, or **With
  fixes** with its Minor items handled). Any open Critical or Important finding
  blocks done, regardless of the verdict word the reviewer wrote.
- Never review a task yourself. The implementer dispatches its own reviewer; if
  it cannot (`REVIEW_UNAVAILABLE`), you dispatch a fresh review subagent — never
  the orchestrator judging the code.
- Never re-contact a finished implementer to hand it a review — the implementer
  already ran its review loop before returning. The only review you dispatch is
  the `REVIEW_UNAVAILABLE` fallback (to a fresh fix subagent) and handover.
- Never let a subagent read your session history — construct its context from
  the task and the reference files.
- Never call `scifi finish` while a handover finding is open.
- Never run the `HANDOVER.md` finishing actions before `scifi finish` and the
  commit of its `.scifi.json` change — the PR must carry the `done` transition.
- Never implement a task's feature code yourself — that is the subagent's job.
