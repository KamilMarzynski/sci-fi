# sf-fix

You run down ONE defect in an EXISTING feature and drive it to a fix. Unlike
`sf-bug`, the work is anchored to a specific feature — you diagnose against that
feature's original intent (its `spec.md`, `design.md`, and ADRs) — and it leaves
a tracked artifact: a fix recorded under the feature, which blocks `scifi finish`
until you resolve it.

The session has two halves separated by a hard seam: first you investigate
*together* until the cause is understood and a fix is chosen, then you implement
that fix test-first under review. You do not start fixing until the user agrees
on which solution to build.

## The Iron Law

```
IDENTIFY FEATURE → INVESTIGATE → REPORT → AGREE → TRACK → FIX → RESOLVE.
NEVER FIX BEFORE THE USER AGREES.
```

## Flow

### 1. Identify the feature

The fix must attach to one feature. Resolve it before anything else.

- `/sf-fix <slug>` — treat the argument as an exact feature slug.
- `/sf-fix <description>` — you were given prose, not a slug. Discover candidates
  from **both** `scifi list --json` and `git worktree list` (an in-flight feature
  lives on its own `feat/<slug>` branch and will not appear in `scifi list` from
  the default checkout). Match candidate features by slug and title. Present your
  best match (or the candidates, if ambiguous) and **confirm the pick with the
  user**. Never guess silently.
- **Locate the feature, then confirm it exists.** Run `git worktree list`; if a
  `feat/<slug>` worktree exists, read `scifi status <slug>` from inside it. Only
  when *no* matching worktree exists **and** `scifi status <slug>` returns
  `NOT_FOUND` from a checkout that would contain it is the feature truly absent —
  then stop: a defect with no owning feature goes to `sf-bug` (untracked), real
  new work to `sf-feature`. Run `scifi status <slug> --json`. If `location` is `worktree:<path>`, enter that worktree before continuing.

Once identified, read the feature's `spec.md` and `design.md`, and grep
`docs/scifi/adr/` for decisions touching the area. Diagnosis is grounded in the
feature's original intent.

**Warn if the feature is not `done`.** A defect in an in-progress feature usually
belongs in `sf-implement`'s own review loop, not a separate tracked fix. Say so,
and proceed only if the user confirms `sf-fix` is what they want.

**Pick the workspace by the feature's state** — the fix must live where the
feature's artifacts live:

- **Feature still in flight** (its `feat/<slug>` worktree exists): work inside
  that worktree, on the feature's branch. The feature directory
  (`docs/scifi/specs/<slug>/`) exists only there, so `scifi fix create` only
  works there — and the open fix blocks `scifi finish` only if it is recorded
  on that branch. Do **not** branch off the default branch: a fix file created
  there is invisible to the feature.
- **Feature `done` and merged**: create an isolated workspace off the default
  branch (shown as `main` — substitute your repo's default branch if it
  differs):

  ```
  git worktree add -b fix/<slug> .worktrees/fix-<slug> main
  ```

  where `<slug>` is the feature slug (or a short fix-specific slug if you are
  fixing several defects in one feature). Work inside it; open the PR from it.

### 2. Capture the symptom

Pin the symptom in the user's words: the error text *verbatim*, the wrong
output, the failing case. Quote it; do not paraphrase. Note the conditions —
environment, data, version, steps.

### 3. Investigate

Reproduce, then find the root cause. One hypothesis at a time.

- **Reproduce** by the smallest path you can. If you cannot make it happen on
  demand, say so and gather more — an unreproducible defect is not ready to fix.
- **Diagnose**: state a single hypothesis in one sentence, confirm or kill it by
  *reading the code* and adding observation (a log, a probe), not by editing a
  fix and watching the symptom move. When a hypothesis is wrong, record what you
  learned and form the next.
- **Confront against the feature.** Check the behavior against `spec.md` and
  `design.md`. A deviation from the original design is itself a strong lead — and
  if the spec is what's wrong, that is a finding, not a code fix.

You have the root cause when you can trace the full chain from trigger to symptom
and point at the line that is wrong and say why. Investigate openly with the
user — share what you find as you find it.

### 4. Report and propose (the gate)

Stop and bring it back to the user. Present:

- **The issue** — the root cause in plain language: what is actually wrong and
  why it produces the symptom. Not the symptom restated.
- **A few solutions** — typically two or three. For each: what it changes, the
  trade-off, and the blast radius. Be honest about a quick patch vs. a deeper fix
  that removes the cause for good. Recommend one and say why.

Debug it together. Fold in pushback and re-propose. Do not move on until the user
has chosen a solution. If this turns out to be a missing feature or a design
change, stop and route it to `sf-feature` — that is not a fix.

### 5. Track

Only *after* the user has chosen, record the tracked artifact:

```
scifi fix create "<description>" --feature <slug> --json
```

Read the returned `id` (e.g. `FIX-0001`) — you need it to resolve the fix later.
Creating it here, after agreement, keeps the recorded description accurate to the
fix you are about to build.

### 6. Fix, test-first under review

Implement the chosen solution — and only that solution.

- **Hold `sf-tdd`.** The defect becomes its first failing test: write a test that
  reproduces it through the public interface at the smallest scope that captures
  it, watch it fail for the *right* reason (the root cause from step 3), then make
  it pass with the minimal change at the cause. Keep the full suite green.
- **Review gate.** Dispatch a code-review subagent with `DISPATCH-CODE-REVIEW.md`
  (ships beside this skill) — a fix-mode review: you pass the **change brief**
  (the root cause and the agreed solution) and the owning feature path, not a
  task file. Act on its report under `sf-receiving-review` with **review type:
  code**. Re-review until the verdict is **Pass** or **With fixes**; a **Fail**
  re-loops. On **With fixes**, address the Minor items (or defer them with the
  user's ok) before accepting. Do not skip it and do not review your own fix.

### 7. Record and resolve

- Write a **lightweight record** into the fix file body (the file at the `path`
  from step 5): the root cause in one or two sentences, the chosen solution, and
  the regression test that now guards it. Keep it short — this is an audit trail,
  not a spec.
- Close the artifact:

  ```
  scifi fix resolve <slug> <id>
  ```

  This transitions the fix `open → resolved` and unblocks `scifi finish`. Use
  `scifi fix wont-fix <slug> <id>` only if the agreed outcome was deliberately
  not to fix — record why in the body first.

## When you are stuck

| Problem | Move |
| --- | --- |
| Can't reproduce | Shrink the variables: pin env, data, version one at a time. |
| Many possible causes | Bisect — halve the suspect surface each step, don't scan it. |
| Symptom moves when you touch it | You patched downstream of the cause. Go upstream. |
| Fix contradicts the feature's spec/design | Surface it — the spec may be the thing that's wrong. |
| User picks a patch over the real fix | Build it — but record the leftover cause as known debt. |

## Done

The fix is done when:

- the target feature is identified and its context read,
- you can state the root cause in one sentence,
- the user agreed on the solution you built,
- a test reproduces the defect, which you watched fail then pass,
- the code review cleared (**Pass**, or **With fixes** with its Minor items
  handled) and the full suite is green,
- the fix file carries the lightweight record and is transitioned to `resolved`
  (or `wont-fix`).

## Hard rules

- Never start fixing before the user has chosen a solution.
- Never fix without first identifying and reading the target feature.
- Never present the symptom as the cause.
- Never ship a fix with no failing test behind it.
- Never leave the tracked fix `open` once the work is settled — resolve it or
  mark it wont-fix.
- Never mark a fix resolved before the code review clears (**Pass**, or **With
  fixes** with its Minor items handled).
