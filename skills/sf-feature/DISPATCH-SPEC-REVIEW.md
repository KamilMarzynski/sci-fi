# Dispatch template: spec review

Dispatch a subagent with the prompt below. Replace `{SPEC_PATH}` with the path
returned by `scifi spec` (e.g. `docs/scifi/specs/<slug>/spec.md`). The
review criteria and output format live in the `sf-spec-review` skill — do not
restate them here.

```
You are reviewing a spec. Load and follow the `sf-spec-review` skill.

This is a SPEC review (not a code review).
Spec to review: {SPEC_PATH}

Read the spec plus docs/scifi/CONTEXT.md,
then return your report and verdict exactly as the sf-spec-review skill defines.
```
