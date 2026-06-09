# sf-receiving-review

You just got a review back — from an `sf-*-review` subagent or from a human.
This skill is how you act on it. Review is technical evaluation, not a social
ritual. Verify before you implement; push back when the reviewer is wrong.

The dispatcher tells you the **review type** (spec, plan, or code). It sets the
lens:

- **spec review** — you are fixing `spec.md`: ambiguity, acceptance criteria,
  scope, architecture/context conflicts. You edit the spec, not source.
- **plan review** — you are fixing `design.md` and the task files: module depth,
  seams, spec coverage, task ordering/validation. You edit the plan, not source.
- **code review** — you are fixing the implementation: bugs, tests, structure.

## The pattern

1. **Read** the whole review before reacting. Do not start fixing mid-list.
2. **Restate** each finding in your own words. If any item is unclear, STOP and
   ask the dispatcher/user — do not implement a partial understanding. Items
   are often related; a wrong guess on one corrupts the others.
3. **Verify** each finding against reality (the spec, the code, the
   architecture/context docs). A reviewer can be wrong or lack context.
4. **Evaluate** for THIS project — not a generic ideal. A "best practice" that
   fights the existing architecture or adds an unused feature (YAGNI) is not an
   improvement.
5. **Respond** with a technical acknowledgment or reasoned pushback. No
   performative agreement.
6. **Implement** one finding at a time, in severity order. Re-verify after each.

## Order of work

- **Critical / blocking** first — wrong requirement, broken behavior, security.
- **Important** next — missing criteria, scope gaps, weak error handling.
- **Minor** last, or defer with the user's ok.

Clarify everything unclear BEFORE you start. Then fix top-down.

## When to push back

Push back — with reasoning, not defensiveness — when the finding:

- contradicts a real constraint in the architecture/context docs,
- breaks existing behavior,
- adds something nothing uses (YAGNI),
- is wrong for this stack, or
- misunderstands the full context.

How: state the technical reason, point at the spec/code/doc that proves it, ask
a specific question. If it is an architectural disagreement, surface it to the
user rather than deciding alone.

If you pushed back and were wrong: say so in one line and fix it. No apology
paragraph, no defending the pushback.

## Forbidden

- "You're absolutely right!" / "Great point!" / "Thanks for catching that!" —
  any performative agreement or gratitude. Just state the fix.
- Implementing before verifying.
- Batching fixes without re-checking each.
- Marking real blockers as minor to avoid work, or nitpicks as critical.

## Closing the loop

After you have addressed (fixed or reasonably pushed back on) every Critical and
Important finding, hand control back to the flow that dispatched you — e.g.
`sf-feature` re-runs `sf-spec-review` to confirm the verdict is now **Pass**
before it proceeds.
