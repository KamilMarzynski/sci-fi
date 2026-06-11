# Dispatch template: bug-fix code review

Dispatch a subagent to review the bug fix before it is accepted. Replace
`{COMMIT_RANGE}` with the commit(s) the fix produced (a SHA or `<base>..HEAD`)
and `{CHANGE_BRIEF}` with the root cause and the solution the user agreed to, in
a sentence or two. There is no feature directory and no task file — this is a
**fix-mode** review. The criteria and output format live in the `sf-code-review`
skill — do not restate them here.

```
You are reviewing a bug fix. Load and follow the `sf-code-review` skill.

This is a CODE review in FIX MODE (no task file, no feature directory).
Changes to review: {COMMIT_RANGE}
Agreed change (the contract): {CHANGE_BRIEF}

Judge the change against that brief: it implements the agreed solution and only
that, a regression test reproduces the bug and now guards it, and no
non-negotiable is triggered. Use docs/scifi/CONTEXT.md for glossary context if
it exists. Return your report and verdict exactly as the sf-code-review skill
defines.
```
