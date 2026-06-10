# sf-fix flow — design

**Date:** 2026-06-10
**Status:** Approved, ready for planning
**Branch:** `feat/sf-fix-flow`

## Premise

`sf-fix` reuses the `sf-bug` flow (investigate → agree → TDD → review) but with
two defining differences:

1. **Anchored to an existing feature.** The fix targets a specific shipped (or
   in-progress) feature, so diagnosis is grounded in that feature's original
   intent — its `spec.md`, `design.md`, and ADRs.
2. **Produces a tracked artifact.** Unlike `sf-bug` (which keeps everything in
   code and tests), `sf-fix` records a fix via `scifi fix` inside the feature's
   `fixes/` directory. The fix blocks `scifi finish` until it is resolved.

The work splits into a small CLI/core addition that completes the fix lifecycle
and the skill prompt itself.

## Part A — CLI: complete the fix lifecycle

### Problem

`scifi fix <description> --feature <slug>` creates a fix at `status: open`.
`scifi finish` blocks while any fix is `open` or `in-progress`. But there is **no
command to transition a fix to `resolved` or `wont-fix`**, so the loop cannot
close through the CLI today.

### CLI surface

Restructure `fix` into a parent command with subcommands, mirroring the existing
`task` command (`task list` / `task start` / `task done`):

```
scifi fix create <description> --feature <slug>   # was: scifi fix <description> --feature
scifi fix resolve  <slug> <id>                    # open | in-progress → resolved
scifi fix wont-fix <slug> <id>                    # open | in-progress → wont-fix
```

This is a **breaking change** to the flat `scifi fix <desc>` form. It is
acceptable: no shipped skill uses `scifi fix` yet, and the parent/subcommand
shape makes `fix` consistent with `task`. Existing CLI tests for the flat form
are updated to the `create` subcommand.

`create` keeps its current behavior and JSON output (returns `id`, `path`, etc.).
`resolve` / `wont-fix` take the feature slug and fix id and emit the transition.

### Core

New `src/core/fixes/transition.ts`:

```
updateFixStatus(projectRoot, featureSlug, fixId, newStatus, now): Promise<FixTransitionResult>
```

- Locate the fix file by id: scan the feature's `fixes/` directory, parse each
  file's frontmatter, match `id`. (The on-disk filename is `<id>-<slug>.md`, but
  resolving by id avoids needing the slug.)
- Validate:
  - `NOT_FOUND` if the feature or the fix id does not exist.
  - Allowed targets for these commands: `resolved`, `wont-fix`. Source status
    must be `open` or `in-progress`; re-resolving an already-resolved fix is an
    `INVALID_ARGUMENT` / `PRECONDITION_FAILED` (pick one consistent with the
    codebase's existing transition errors).
- Rewrite the fix file's `status` frontmatter via the existing
  `writeFixFile` / `readFixFile`, preserving the body.
- Return `{ id, slug, feature, previousStatus, newStatus, timestamp }`.

CLI handlers stay thin and delegate to the core function, following the `task`
command pattern. Errors surface through `ScifiError` and `emitError`.

A small helper to find a fix file by id (scan + parse) lives in
`src/core/fixes/list.ts` or `transition.ts` — wherever keeps the module focused.

## Part B — skill `sf-fix/body.md`

The skill orchestrates one fix against one feature. It mirrors `sf-bug`'s rigor
about the investigate/fix seam, adds feature anchoring at the front, and adds
artifact tracking + resolution at the back.

### Iron law

```
IDENTIFY FEATURE → INVESTIGATE → REPORT → AGREE → TRACK → FIX → RESOLVE.
NEVER FIX BEFORE THE USER AGREES.
```

### Flow

1. **Identify the feature.**
   - `/sf-fix <slug>` → treat as an exact slug; confirm it exists
     (`scifi status <slug>`).
   - `/sf-fix <description>` → run `scifi list --json`, match candidate features
     by slug/title, and **confirm the pick with the user** before proceeding —
     never guess silently. On ambiguity, present the candidates and ask.
   - No match → stop. Point the user at `sf-bug` (untracked, no feature) or
     `sf-feature` (if it is really new work).
   - Once identified, read the feature's `spec.md` and `design.md` and grep
     `docs/scifi/adr/` for relevant decisions. Diagnosis is grounded in the
     feature's original intent.
   - **Warn if the feature is not `done`.** In-progress defects usually belong in
     `sf-implement`'s review loop, not a tracked fix. Proceed only if the user
     confirms.

2. **Capture the symptom.** Pin the symptom in the user's words — error text
   verbatim, wrong output, failing case. Note the conditions.

3. **Investigate.** Reproduce by the smallest path; find the root cause one
   hypothesis at a time by reading code and adding observation, not by editing a
   fix and watching the symptom move. Confront findings against the feature's
   `spec.md` / `design.md` — a deviation from the original design is itself a
   strong lead. Investigate openly with the user.

4. **Report and propose (the gate).** Present the root cause in plain language
   and two or three solutions with trade-offs and blast radius; recommend one.
   Debug together; fold in pushback and re-propose. Do not move on until the user
   has chosen a solution. If it turns out to be a missing feature or a design
   change, stop and route to `sf-feature`.

5. **Track.** *After* the user agrees, create the tracked artifact:

   ```
   scifi fix create "<description>" --feature <slug> --json
   ```

   Capture the returned `id` — it is needed to resolve the fix later. Creating it
   here (not earlier) keeps the recorded description accurate to the agreed fix.

6. **Fix, test-first.** Hold `sf-tdd`. The defect becomes its first failing
   test, reproduced through the public interface at the smallest scope; watch it
   fail for the *right* reason (the root cause from step 3), then make it pass
   with the minimal change at the cause. Keep the full suite green.

7. **Review gate.** Dispatch a code-review subagent that loads `sf-code-review`,
   act on its report under `sf-receiving-review` with **review type: code**,
   re-review until the verdict is **Pass**. Do not review your own fix.

8. **Record and resolve.** Write a **lightweight record** into the fix file body:
   the root cause (1–2 sentences), the chosen solution, and the regression test
   that guards it. Then close the artifact:

   ```
   scifi fix resolve <slug> <id>
   ```

   This transitions the fix `open → resolved` and unblocks `scifi finish`.
   (Use `scifi fix wont-fix` only if the agreed outcome was deliberately not to
   fix — record why in the body first.)

### When you are stuck

A small table mirroring `sf-bug` (can't reproduce, many causes, symptom moves,
user picks a patch), adapted with one fix-specific row: *fix contradicts the
feature's spec/design → surface it; the spec may be the thing that is wrong.*

### Done

The fix is done when:
- the targeted feature is identified and its context read,
- the root cause is stated in one sentence,
- the user agreed on the solution built,
- a regression test was watched fail then pass,
- the code review verdict is **Pass** and the suite is green,
- the fix file carries the lightweight record and is transitioned to `resolved`
  (or `wont-fix`).

### Hard rules

- Never start fixing before the user has chosen a solution.
- Never fix without first identifying and reading the target feature.
- Never present the symptom as the cause.
- Never ship a fix with no failing test behind it.
- Never leave the tracked fix `open`/`in-progress` once the work is settled —
  resolve or `wont-fix` it.
- Never mark resolved before the code review verdict is **Pass**.

## Part C — tests & docs

- **Core unit tests** for `updateFixStatus`: each valid transition, `NOT_FOUND`
  (missing feature, missing id), illegal target / illegal source status, body
  preservation.
- **CLI integration tests** for `fix create` / `fix resolve` / `fix wont-fix`,
  including JSON output shape; update existing flat-`fix` tests to `fix create`.
- **End-to-end**: a resolved fix unblocks `scifi finish`; an open fix still
  blocks it.
- **Installed-build verification** via the `.testing/` workspace per `TESTING.md`
  — `scifi fix create` / `resolve` and the skill manifest install correctly.
- **Docs**: update README skill count / catalog as needed; refine
  `skills/sf-fix/manifest.ts` description and `argumentHint` to reflect the
  feature-anchored flow.

## Out of scope

- A `scifi fix list` subcommand — `scifi status <slug>` already lists fixes.
- Reopening a resolved fix — not needed by this flow.
- Changing `sf-bug` or the `finish` blocking semantics.
