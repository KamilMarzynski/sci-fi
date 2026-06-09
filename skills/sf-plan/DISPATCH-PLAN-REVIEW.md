# Dispatch template: plan review

Dispatch a subagent with the prompt below. Replace `{FEATURE_PATH}` with the
feature directory returned by `scifi plan` (e.g.
`docs/scifi/specs/<slug>`). The review criteria and output format live in the
`sf-plan-review` skill — do not restate them here.

```
You are reviewing an implementation plan. Load and follow the `sf-plan-review` skill.

This is a PLAN review (not a spec review, not a code review).
Feature to review: {FEATURE_PATH}

Read {FEATURE_PATH}/design.md, {FEATURE_PATH}/spec.md, every file under
{FEATURE_PATH}/tasks/, plus docs/scifi/ARCHITECTURE.md and
docs/scifi/CONTEXT.md, then return your report and verdict exactly as the
sf-plan-review skill defines.
```
