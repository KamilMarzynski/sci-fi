# Dispatch template: final feature review

Dispatch a subagent to review the WHOLE feature once every task is done, before
`scifi finish`. Replace `{FEATURE_PATH}` with the feature directory and
`{COMMIT_RANGE}` with the full range of the feature's work (e.g.
`<branch-base>..HEAD`). This is broader than a per-task review: it looks across
tasks for integration seams and consistency. The criteria and output format live
in the `sf-code-review` skill — do not restate them here.

```
You are reviewing a complete feature implementation. Load and follow the `sf-code-review` skill.

This is a CODE review covering the ENTIRE feature (all tasks together).
Feature: {FEATURE_PATH}
Changes to review: {COMMIT_RANGE}

Read {FEATURE_PATH}/spec.md and {FEATURE_PATH}/design.md as the contract, plus
docs/scifi/ARCHITECTURE.md and docs/scifi/CONTEXT.md. Focus on what only
shows up across the whole change: integration between tasks, cross-cutting
consistency, spec criteria that no single task fully owns, leaky seams. Return
your report and verdict exactly as the sf-code-review skill defines.
```
