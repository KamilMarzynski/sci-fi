---
name: sf-bug
description: Investigate one bug with the user, agree on a solution, then fix it
  test-first under review. No spec or tracked artifact.
argument-hint: "[description]"
---
# sf-bug

You run down ONE bug with the user and drive it to a fix. The session has two
halves: first you investigate *together* until the cause is understood and a fix
is chosen, then you implement that fix test-first under review. This skill is
rigid about the seam between them — you do not start fixing until the user has
agreed on which solution to build.

There is no spec and no tracked artifact for a bug. A bug is not a feature: its
solution emerges from diagnosis, not design. Keep the work in code and tests,
not in documents.

## The Iron Law

```
INVESTIGATE → REPORT → AGREE → FIX. NEVER FIX BEFORE THE USER AGREES.
```

The user reported a bug, not a fix. Your job in the first half is to understand
it well enough to lay out real options; the choice between them is theirs.

## Flow

### 1. Capture the report

- Pin the symptom in the user's words: the error text *verbatim*, the wrong
  output, the failing case. Quote it; do not paraphrase.
- Note the conditions they hit it under — environment, data, version, steps.

Before investigating, create an isolated workspace from the default branch
(shown as `main` below — substitute your repo's default branch if it differs):

```
git worktree add -b fix/<slug> .worktrees/fix-<slug> main
```

Derive `<slug>` from the bug (e.g. `stale-token-refresh`). Work inside it; open
the PR from it. A bug is untracked, so there is no `scifi` pointer to record.

### 2. Investigate

Reproduce, then find the root cause. One hypothesis at a time.

- **Reproduce** by the smallest path you can. If you cannot make it happen on
  demand, say so and gather more from the user — an unreproducible bug is not
  ready to fix.
- **Diagnose**: state a single hypothesis about the cause in one sentence,
  confirm or kill it by *reading the code* and adding observation (a log, a
  probe), not by editing a fix and watching the symptom move. When a hypothesis
  is wrong, record what you learned and form the next.
- You have the root cause when you can trace the full chain from trigger to
  symptom and point at the line that is wrong and say why.

Investigate openly with the user — share what you find as you find it. This is a
debugging session, not a silent report you deliver at the end.

### 3. Report and propose (the gate)

Stop and bring it back to the user. Present:

- **The issue** — the root cause in plain language: what is actually wrong and
  why it produces the symptom. Not the symptom restated.
- **A few solutions** — typically two or three. For each: what it changes, the
  trade-off, and the blast radius. Be honest about a quick patch vs. a deeper
  fix that removes the cause for good. Recommend one and say why.

Then debug it together. The user may push back, add context, or reframe the
problem — fold that in and re-propose. Do not move on until the user has chosen
a solution. If diagnosis turns up that this is really a missing feature or a
design decision, say so and stop — that belongs in `sf-feature`, not here.

### 4. Fix, test-first under review

Once the user has chosen, implement that solution — and only that solution.

- **Hold `sf-tdd`.** The bug becomes its first failing test: write a test that
  reproduces it through the public interface at the smallest scope that captures
  it, watch it fail for the *right* reason (the root cause from step 2), then
  make it pass with the minimal change at the cause. Keep the full suite green.
- **Review gate.** Dispatch a code-review subagent with `DISPATCH-CODE-REVIEW.md`
  (ships beside this skill) — a fix-mode review: you pass the **change brief**
  (the root cause and the agreed solution), not a task file. Act on its report
  under `sf-receiving-review` with **review type: code**. Re-review until the
  verdict is **Pass** or **With fixes**; a **Fail** re-loops. On **With fixes**,
  address the Minor items (or defer them with the user's ok) before accepting.
  Do not skip it and do not review your own fix.

The regression test is the point: it proves the bug existed and guards its
return.

## When you are stuck

| Problem | Move |
| --- | --- |
| Can't reproduce | Shrink the variables: pin env, data, version one at a time. |
| Many possible causes | Bisect — halve the suspect surface each step, don't scan it. |
| Symptom moves when you touch it | You patched downstream of the cause. Go upstream. |
| User picks a patch over the real fix | Build it — but record the leftover cause as known debt. |

## Done

The bug is done when:

- you can state the root cause in one sentence,
- the user agreed on the solution you built,
- a test reproduces the bug, which you watched fail then pass,
- the code review cleared (**Pass**, or **With fixes** with its Minor items
  handled) and the full suite is green.

## Hard rules

- Never start fixing before the user has chosen a solution.
- Never present the symptom as the cause.
- Never ship a fix with no failing test behind it.
- Never catch or silence the error in place of removing its cause.
- Never mark done before the code review clears (**Pass**, or **With fixes** with
  its Minor items handled).
