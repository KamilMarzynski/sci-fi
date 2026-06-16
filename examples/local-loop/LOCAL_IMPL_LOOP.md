<!--
  Loop prompt for autonomous local implementation of plan-ready scifi features.
  Invoke it from a checkout on `main` with:

      /loop 10m @LOCAL_IMPL_LOOP.md

  The `@`-mention passes this file's contents as the loop prompt, so it runs
  every 10 minutes for as long as the session stays open. (An @-mention is
  expanded when you issue the command, so it is snapshotted once — re-issue
  `/loop` after editing this file. If you want a prompt that reloads each
  iteration instead, put the same body at `.claude/loop.md` and run a bare
  `/loop 10m`.) The README explains the design and the skill's assumptions.
  Everything below the comment is the prompt sent to the model each iteration.
-->

Poll for plan-ready scifi features on `main` and implement each one autonomously.
Run the steps below once per iteration, then end with a one-line summary.

1. **Sync `main`.** Run `git checkout main && git pull --ff-only`. If the pull
   cannot fast-forward (local commits, dirty tree, conflict), print one line
   explaining why and end the iteration without doing anything else — never force
   or merge to get past it.

2. **Find ready work.** Run `scifi list --status plan-ready --json`. Each NDJSON
   line is a feature; collect the `slug` values. If there are none, say
   "no plan-ready features" in one line and end the iteration.

3. **Implement each slug, one at a time.** For every plan-ready slug, first
   confirm it is not already being worked: skip it if `scifi status <slug> --json`
   no longer reports `plan-ready`. For each remaining slug, dispatch **one**
   subagent and wait for it to finish before starting the next (serial, to bound
   token and CPU use — anything still pending is picked up next iteration). Give
   the subagent this task:

   > Implement the scifi feature `<slug>` to completion.
   >
   > **Work inside a feature worktree, never the `main` checkout.**
   > `sf-implement` expects to start inside the worktree `sf-feature` created and
   > does not make one. Run `scifi status <slug> --json` and read its `worktree`
   > path and `branch`. That path was recorded when the spec was authored and
   > committed with it, so it points at the authoring machine — it exists here
   > only if this is that machine. If the directory exists and is a worktree for
   > `branch`, `cd` into it. Otherwise create one on this machine —
   > `git worktree add <path> <branch>` (branch already exists), record it with
   > `scifi worktree set <slug> --branch <branch> --path <path>`, and `cd` there.
   > Run everything from inside that worktree.
   >
   > Then run `/sf-implement <slug>` and drive the full flow — prove the harness,
   > one TDD implementer per task gated on its code review, handover, finish,
   > `HANDOVER.md`. You are unattended: never pause to ask for confirmation.
   >
   > **Resolve the two decisions the skill would normally put to a human:**
   > - *Critical blocker* — an ambiguous or contradictory spec, a verification
   >   harness that will not run, or a task whose plan is wrong. Do **not** guess
   >   past it. Stop, commit what is verified, and open a **draft** PR titled
   >   `[blocked] sf-implement: <slug>` with headings **Implemented** /
   >   **Not implemented** / **Blocker** / **How to continue**.
   > - *Untracked workflow artifacts at handover* (the spec dir, new ADRs,
   >   `CONTEXT.md` edits). Default to committing them **with the feature** so the
   >   branch is self-contained; do not stall on this and do not git-ignore them.
   >
   > On clean completion run `scifi finish`, commit the `.scifi.json` transition,
   > and open a normal (non-draft) PR per `HANDOVER.md`. Always leave the branch
   > pushed and checkout-able. Finish by printing `scifi status <slug> --json` so
   > the result is visible.

4. **Summarize.** End the iteration with one line per slug: dispatched or skipped,
   and the final status reported by the subagent.

Never commit to `main` directly beyond the fast-forward pull. Never start a second
run for a slug that is already in progress.
