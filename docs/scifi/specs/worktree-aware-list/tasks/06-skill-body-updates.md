---
id: TASK-006
slug: skill-body-updates
status: pending
depends-on: [TASK-004]
---

# Update skill bodies to drop wrong-checkout caveat

## Goal

Remove the outdated "`NOT_FOUND` from `scifi status` means wrong checkout" guidance from the shipped skill bodies and replace it with instructions to use the `location` field.

## Tests first

No automated tests for skill-body prose. The validation step will grep for removed phrases and inspect the new guidance.

## Work

1. Edit `skills/sf-change/body.md`:
   - Remove the paragraph ending with "A `NOT_FOUND` while a worktree exists just means you are in the wrong checkout, not that the feature is gone."
   - Replace with: "Run `scifi status <slug> --json`. If `location` is `worktree:<path>`, enter that worktree before continuing."
2. Edit `skills/sf-fix/body.md` with the same replacement.
3. Edit `skills/sf-continue/body.md`:
   - Remove the paragraph beginning "Running `scifi status <slug>` from the default checkout would otherwise report `NOT_FOUND`..."
   - Remove "A `NOT_FOUND` while a matching worktree exists just means you are in the wrong checkout — enter the worktree and re-read; never route the user to start a new feature in that case."
   - Update the flow to: run `scifi status <slug>` anywhere; if `location` is `worktree:<path>`, enter that worktree, then re-read state from there.
4. No source-code call sites are affected.

## Validation

```bash
grep -L "wrong checkout" skills/sf-change/body.md skills/sf-fix/body.md skills/sf-continue/body.md
# and confirm the new guidance is present:
grep "location.*worktree" skills/sf-change/body.md skills/sf-fix/body.md skills/sf-continue/body.md
```

## Satisfies

- "`sf-change`, `sf-fix`, and `sf-continue` skill bodies ... no longer say that `NOT_FOUND` from `scifi status` means 'wrong checkout'; instead they tell the user to enter the worktree shown in `location: worktree:<path>` before continuing."
