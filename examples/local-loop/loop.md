<!--
  Default /loop prompt for autonomous local implementation of plan-ready scifi
  features. Copy this file to `.claude/loop.md` in the target repo (project-level
  path; `~/.claude/loop.md` is the user-level fallback). With it in place, a bare
  `/loop 10m` runs the instructions below every 10 minutes for as long as the
  session stays open. The README explains the design and how it differs from the
  GitHub Actions example. Everything below the comment is the prompt sent to the
  model each iteration; keep it directive.
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
   no longer reports `plan-ready`, or if a branch or worktree for it already
   exists. For each remaining slug, dispatch **one** subagent and wait for it to
   finish before starting the next (serial, to bound token and CPU use — anything
   still pending is picked up on the next iteration). Give the subagent this task:

   > Run `/sf-implement <slug>` and drive it to completion following
   > `docs/scifi/HANDOVER.md`. You are running unattended: never pause to ask for
   > confirmation. On a critical blocker — an ambiguous or contradictory spec, a
   > verification harness that will not run, or a task whose plan is wrong — stop,
   > commit everything that is verified, and open a **draft** PR titled
   > `[blocked] sf-implement: <slug>` with headings **Implemented** /
   > **Not implemented** / **Blocker** / **How to continue**. On clean completion,
   > run `scifi finish` and open a normal (non-draft) PR per `HANDOVER.md`. Always
   > leave the branch pushed and checkout-able. Finish by printing the output of
   > `scifi status <slug> --json` so the result is visible.

4. **Summarize.** End the iteration with one line per slug: dispatched or skipped,
   and the final status reported by the subagent.

Never commit to `main` directly beyond the fast-forward pull. Never start a second
run for a slug that is already in progress.
