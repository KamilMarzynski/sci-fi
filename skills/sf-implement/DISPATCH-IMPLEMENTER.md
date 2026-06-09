# Dispatch template: task implementer

Dispatch a subagent to implement ONE task test-first. Replace `{FEATURE_PATH}`
with the feature directory, `{TASK_SLUG}` with the task, and `{TASK_BODY}` with
the full inlined contents of the task file (do not make the subagent search for
it). Pick the model from the task's size — a single-file task with a complete
spec runs on a cheap model; multi-file or judgment-heavy tasks need a stronger
one. The TDD discipline lives in `sf-tdd`; do not restate it here.

```
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
commit when green.

Report back with a status line and a one-line summary:
- DONE — built, tests green, validation passes, committed.
- DONE_WITH_CONCERNS — done, but flag doubts about correctness or scope.
- NEEDS_CONTEXT — name exactly what information is missing.
- BLOCKED — state what stops you.
Do not mark the task done — the orchestrator does that after code review.
```
