# Dispatch template: task implementer

Dispatch a subagent to implement ONE task test-first **and run its own code
review before returning**. Replace `{FEATURE_PATH}` with the feature directory,
`{TASK_SLUG}` with the task, and `{TASK_BODY}` with the full inlined contents of
the task file (do not make the subagent search for it). Replace
`{CODE_REVIEW_DISPATCH}` with the full contents of `DISPATCH-CODE-REVIEW.md`
(ships beside this skill) — the implementer uses it to dispatch its reviewer.
Pick the model from the task's size — a single-file task with a complete spec
runs on a cheap model; multi-file or judgment-heavy tasks need a stronger one.
The TDD discipline lives in `sf-tdd`; do not restate it here. The outer prompt
below is fenced with four backticks so the triple-backtick fences inside
`DISPATCH-CODE-REVIEW.md` survive substitution into `{CODE_REVIEW_DISPATCH}`
without closing this block early.

````
You are implementing one task from an approved plan. Load and follow the `sf-tdd` skill.

Task: {TASK_SLUG}  (feature: {FEATURE_PATH})

--- task ---
{TASK_BODY}
--- end task ---

Reference only as needed (do not implement anything outside this task):
- {FEATURE_PATH}/spec.md      — the contract.
- {FEATURE_PATH}/design.md    — modules, seams, test strategy.
- docs/scifi/CONTEXT.md — glossary (ubiquitous language).

Build exactly this task, test-first per sf-tdd. Stay inside the task's scope —
no extra features, no unrelated refactors. Run the task's Validation step and
commit when green — stage only the files this task touched, never a blanket
`git add -A` (the worktree may carry unrelated workflow artifacts). If a
verification command will not run (missing deps, broken harness), that is
BLOCKED — report it, do not work around it.

--- code-review gate (you run this yourself, do not skip) ---
Once your work is green and committed, gate it with a code review — you own this
loop, the orchestrator does not run it for you:

1. Dispatch a FRESH code-review subagent (clean context — never review your own
   work) using the template below, filling {COMMIT_RANGE} with the SHA(s) you
   produced, {FEATURE_PATH}, and {TASK_SLUG}:

{CODE_REVIEW_DISPATCH}

2. Act on its report in YOUR context, governed by the `sf-receiving-review` skill
   with review type: code. You hold the task's full context, so you fix findings
   directly — no cold re-derivation.
3. Re-dispatch a fresh reviewer until the verdict clears: Pass, or a clean With
   fixes. Critical and Important findings are both must-fix and re-loop — the
   findings govern, not the verdict word (a "With fixes" listing an Important is
   a mislabel). Only Minor items may be deferred, and only with explicit ok.

If — and only if — you cannot dispatch a reviewer at all (this harness does not
let you spawn a subagent), stop and report REVIEW_UNAVAILABLE so the orchestrator
runs the gate instead. Do not skip the review and report DONE.
--- end code-review gate ---

Report back with a status line, a one-line summary, a `Commit:` line giving the
SHA(s) you produced (or `<base>..HEAD`), and — for DONE — the final reviewer
verdict and a one-line note of what the review cleared:
- DONE — built, tests green, validation passes, committed, AND your code-review
  loop cleared (Pass or clean With fixes).
- DONE_WITH_CONCERNS — done and review-clear, but you flag doubts about
  correctness or scope.
- REVIEW_UNAVAILABLE — work is committed but you could not dispatch a reviewer;
  the orchestrator must run the gate. Give the Commit range.
- NEEDS_CONTEXT — name exactly what information is missing.
- BLOCKED — state what stops you (including a verification command that won't run).
Do not mark the task done — the orchestrator does that after the gate clears.
````
