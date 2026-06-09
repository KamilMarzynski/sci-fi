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
- `docs/scifi/ARCHITECTURE.md` and `docs/scifi/CONTEXT.md` — referenced by
  subagents; know where they are so you can point to them.

`<path>` is the feature directory (`docs/scifi/specs/<slug>/`).

## Flow

### 1. Start the feature

```
scifi start <slug> --json
```

Transitions `plan-ready → in-progress`. If it errors `PRECONDITION_FAILED`, the
feature is not plan-ready — stop and tell the user to finish `sf-plan` first.

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
   architecture, context). The implementer loads `sf-tdd` and builds the task
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
   `DISPATCH-CODE-REVIEW.md`, which loads the `sf-code-review` skill. Hand its
   report to the *same* implementer subagent to act on, governed by
   `sf-receiving-review` with **review type: code**. Re-review until the verdict
   is **Pass**. Do not skip this and do not review it yourself.

5. **Mark done.**

   ```
   scifi task done <slug> <task>
   ```

   This unlocks dependents. Move to the next runnable task.

Run continuously — do not stop to ask "should I continue?" between tasks. Stop
only for a `BLOCKED` you cannot resolve, a genuine ambiguity, or all tasks done.

### 4. Final review and verification

After every task is `done`:

- Dispatch a whole-feature code review (`DISPATCH-FINAL-REVIEW.md`) over the
  complete change, not just the last task — integration seams and cross-task
  consistency only show up here.
- Run `sf-verification` to exercise the feature the way `EVALUATION.md`
  prescribes (start the app, drive it, e.g. Playwright).
- Route every finding back to a subagent to fix; the orchestrator coordinates
  but does not fix substantial issues itself. Only trivially small fixes are
  yours. Re-review until clean.

### 5. Finish

```
scifi finish <slug> --json
```

Transitions `in-progress → done`. This is the end of the implement stage.

## Hard rules

- Never dispatch two implementer subagents at once — serial only.
- Never mark a task done before its code review verdict is **Pass**.
- Never let a subagent read your session history — construct its context from
  the task and the reference files.
- Never call `scifi finish` while a final-review or verification finding is
  open.
- Never implement a task's feature code yourself — that is the subagent's job.
