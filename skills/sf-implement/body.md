# sf-implement

You orchestrate the implementation of ONE plan-ready feature. You do not write
the feature's code yourself. You dispatch a fresh subagent per task, gate each
on a code review, and drive the whole feature to done. Your context stays clean
for coordination; each subagent gets exactly the context it needs and nothing
from your history.

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

### 3. Per task: dispatch → review → done

For each runnable task, in order:

1. **Mark in-progress.**

   ```
   scifi task start <slug> <task>
   ```

2. **Dispatch the implementer.** Use `DISPATCH-IMPLEMENTER.md` (ships beside
   this skill). Inline the full task body into the prompt — do **not** make the
   subagent hunt for it — and give it the reference paths (spec, design,
   context). The implementer loads `sf-tdd` and builds the task
   test-first.

3. **Handle the implementer's status:**
   - `DONE` — proceed to review.
   - `DONE_WITH_CONCERNS` — read the concerns. Correctness/scope concerns: fix
     before review. Observations: note and proceed.
   - `NEEDS_CONTEXT` — provide the missing context, re-dispatch.
   - `BLOCKED` — assess: more context (re-dispatch), too large (split the task),
     or the plan itself is wrong (escalate to the user). Never blindly re-run
     the same dispatch unchanged.

4. **Review gate (single review).** Dispatch a code-review subagent with
   `DISPATCH-CODE-REVIEW.md`, which loads the `sf-code-review` skill. Fill
   `{COMMIT_RANGE}` with the commit(s) the implementer reported for this task
   (its `Commit:` line), plus `{FEATURE_PATH}` and `{TASK_SLUG}`. Hand its
   report to the *same* implementer subagent to act on, governed by
   `sf-receiving-review` with **review type: code**. Re-review until the verdict
   is **Pass** or **With fixes**; a **Fail** re-loops. On **With fixes**, the
   implementer addresses the Minor items (or you defer them with the user's ok)
   before the task is marked done. Do not skip this and do not review it
   yourself.

5. **Mark done.**

   ```
   scifi task done <slug> <task>
   ```

   This unlocks dependents. Move to the next runnable task.

Run continuously — do not stop to ask "should I continue?" between tasks. Stop
only for a `BLOCKED` you cannot resolve, a genuine ambiguity, or all tasks done.

### 4. Handover

After every task is `done`:

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
- When handover passes, read `docs/scifi/HANDOVER.md` if it exists and run the
  finishing actions it defines, in order — smoke tests, PR creation, invoking
  any skills it points to. These run here at the orchestrator's top level (not
  inside a subagent) so irreversible or visible actions stay visible. If the
  file is absent, there are no finishing actions and you go straight to finish.

### 5. Finish

```
scifi finish <slug> --json
```

Transitions `in-progress → done`. Run this **last** — after handover passes and
after every `HANDOVER.md` action (PR creation included) has completed. This is
the end of the implement stage.

## Hard rules

- Never dispatch two implementer subagents at once — serial only.
- Never mark a task done before its code review clears (**Pass**, or **With
  fixes** with its Minor items handled).
- Never let a subagent read your session history — construct its context from
  the task and the reference files.
- Never call `scifi finish` while a handover finding is open or a `HANDOVER.md`
  action is still pending.
- Never implement a task's feature code yourself — that is the subagent's job.
