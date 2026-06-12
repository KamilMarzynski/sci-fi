---
id: T6
slug: final-check
status: in-progress
depends-on:
  - T1
  - T2
  - T3
  - T4
  - T5
---

# Final verification: npm run check passes

## Goal

Confirm the entire change set satisfies the project quality bar — linting, type-checking, and all tests pass.

## Tests first

Not applicable — this task is pure validation.

## Work

1. Run the project check command.
2. If any failures appear, diagnose whether they are caused by this feature's changes or pre-existing issues.
3. Fix any issues introduced by this feature.

## Validation

```bash
npm run check
```

Must exit 0 with no errors.

## Satisfies

- `npm run check` passes after changes
