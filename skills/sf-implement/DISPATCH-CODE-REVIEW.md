# Dispatch template: per-task code review

Dispatch a subagent to review ONE completed task before it is marked done.
Replace `{FEATURE_PATH}` with the feature directory, `{TASK_SLUG}` with the task,
and `{COMMIT_RANGE}` with the commit(s) the implementer produced (e.g. a SHA or
`<base>..HEAD`). The review criteria and output format live in the
`sf-code-review` skill — do not restate them here.

```
You are reviewing the implementation of one task. Load and follow the `sf-code-review` skill.

This is a CODE review (not a spec review, not a plan review).
Task under review: {TASK_SLUG}  (feature: {FEATURE_PATH})
Changes to review: {COMMIT_RANGE}

Judge the change against {FEATURE_PATH}/design.md and the task's own
acceptance/validation, with docs/specflow/ARCHITECTURE.md and
docs/specflow/CONTEXT.md for context. Return your report and verdict exactly as
the sf-code-review skill defines.
```
