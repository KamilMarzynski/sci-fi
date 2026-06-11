# Dispatch template: handover

Dispatch the final subagent once every task is `done`, before `scifi finish`.
Replace `{FEATURE_PATH}` with the feature directory and `{COMMIT_RANGE}` with the
full range of the feature's work (e.g. `<branch-base>..HEAD`). The checks and
output format live in the `sf-handover` skill — do not restate them here.

```
You are running handover for a complete feature implementation. Load and follow the `sf-handover` skill.

Feature: {FEATURE_PATH}
Changes to verify: {COMMIT_RANGE}

Verify the whole feature against {FEATURE_PATH}/spec.md and
{FEATURE_PATH}/design.md, plus docs/scifi/CONTEXT.md, and run the final quality
check the skill defines. If docs/scifi/HANDOVER.md exists, list its finishing
actions for the orchestrator to run — do not execute them. Return your verdict,
findings, and handover actions exactly as the sf-handover skill defines.
```
