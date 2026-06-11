# Dispatch template: tracked-fix code review

Dispatch a subagent to review the fix before it is resolved. Replace
`{COMMIT_RANGE}` with the commit(s) the fix produced (a SHA or `<base>..HEAD`),
`{CHANGE_BRIEF}` with the root cause and the solution the user agreed to (a
sentence or two), and `{FEATURE_PATH}` with the owning feature directory (e.g.
`docs/scifi/specs/<slug>`). There is no task file — this is a **fix-mode**
review, but the feature's spec/design are available as original intent. The
criteria and output format live in the `sf-code-review` skill — do not restate
them here.

```
You are reviewing a tracked fix. Load and follow the `sf-code-review` skill.

This is a CODE review in FIX MODE (no task file; an owning feature exists).
Changes to review: {COMMIT_RANGE}
Agreed change (the contract): {CHANGE_BRIEF}
Owning feature: {FEATURE_PATH}

Judge the change against the brief: it implements the agreed solution and only
that, a regression test reproduces the defect and now guards it, and it does not
reintroduce a deviation from {FEATURE_PATH}/spec.md or {FEATURE_PATH}/design.md.
Use docs/scifi/CONTEXT.md for glossary context if it exists. Return your report
and verdict exactly as the sf-code-review skill defines.
```
