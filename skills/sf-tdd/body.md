# sf-tdd

You are implementing ONE task test-first. This skill is the discipline you hold
while you do it. It is rigid: follow it exactly. Violating the letter of these
rules violates their spirit.

You were almost certainly dispatched by `sf-implement` with a single task to
build. Your task file's **Tests first** section is your starting list of
behaviors. Build them one at a time.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

If you wrote implementation before its test, delete it. Not "keep as reference",
not "adapt it while writing the test" — delete, then re-derive it from the test.
If you never watched a test fail, you do not know that it tests anything.

## Vertical slices, never horizontal

Do **not** write all the tests, then all the code. That "horizontal" split
produces tests of *imagined* behavior — they check the shape of things and stay
green when behavior actually breaks.

Work in **vertical** slices instead: one test → make it pass → next test. Each
test responds to what the previous cycle taught you.

```
WRONG (horizontal):  test1 test2 test3  →  impl1 impl2 impl3
RIGHT (vertical):    test1 → impl1 → test2 → impl2 → test3 → impl3
```

## The loop: red → green → refactor

For each behavior in the task:

1. **RED — write one failing test.**
   - One behavior. A name that reads like a spec ("rejects empty email"), not
     "test1" and not "validates email and domain and whitespace" (the "and"
     means split it).
   - Test observable behavior through the public interface. Real code paths, no
     mocks of your own modules.

2. **Verify RED — watch it fail. MANDATORY, never skip.**
   - Run the test. Confirm it *fails*, not *errors*, and fails for the right
     reason: the behavior is missing, not a typo or bad import.
   - Passes already? It tests existing behavior — rewrite it.
   - Errors? Fix the error and re-run until it fails cleanly.

3. **GREEN — minimal code to pass.**
   - The simplest thing that makes this one test pass. No speculative options,
     no config knobs nothing calls yet (YAGNI). Don't improve unrelated code.

4. **Verify GREEN — watch it pass.**
   - This test passes, and every other test still passes, with pristine output
     (no stray errors or warnings). Other tests broke? Fix them now.

5. **REFACTOR — only while green.**
   - Remove duplication, improve names, deepen modules (push complexity behind a
     narrow interface). Re-run tests after each step; stay green throughout.
   - **Never refactor while red.** Get to green first.

Then repeat for the next behavior.

## Depth while you refactor

Same lens `sf-plan` used to design these modules — hold it as you clean up:

- A **deep** module hides a lot of behavior behind a small interface. Prefer it.
- Distrust the shallow: a "utils" grab bag, a class that only forwards calls, a
  function extracted solely so a test can reach it.
- Deletion test: would removing this unit *concentrate* complexity (keep it) or
  just *scatter* it (inline it)?

If the design module you were handed turns out shallow, say so in your report —
do not silently redesign across task boundaries.

## Mock only at the boundary

Mock external APIs, the clock, randomness, sometimes the database or filesystem.
Do **not** mock your own modules or internal collaborators — that couples the
test to implementation and it breaks on every refactor. If something is hard to
test without mocking internals, the design is too coupled: inject the dependency
or narrow the seam, don't reach for a mock.

A test that verifies "the system saved a user" should read the user back through
the public interface, not query the database directly.

## When you are stuck

| Problem | Move |
| --- | --- |
| Don't know how to test it | Write the wished-for call and assertion first. |
| Test is complicated | The design is complicated. Simplify the interface. |
| Must mock everything | Too coupled. Inject dependencies. |
| Test setup is huge | Extract helpers; if still huge, simplify the design. |

## Done

The task is done (from your side) when:

- every behavior in **Tests first** has a test that you watched fail then pass,
- the full suite is green with pristine output,
- the task's **Validation** step passes,
- you committed the work.

Hand back to `sf-implement` with your status (`DONE`, `DONE_WITH_CONCERNS`,
`NEEDS_CONTEXT`, or `BLOCKED`) and a one-line summary. The orchestrator runs the
code review — you do not mark the task done yourself.

## Red flags — stop and start over

- Production code with no failing test behind it.
- A test that passed the first time you ran it.
- You cannot say why a test failed.
- "I'll add tests after." / "Too simple to test." / "Just this once."

Each of these means: delete the untested code, return to RED.
