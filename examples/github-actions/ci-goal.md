# CI implementation goal (headless guardrail)

This text is injected into the headless run via `claude -p
--append-system-prompt`. It pairs with `/goal`:

- **`/goal`** (set in the workflow) is the *completion loop* — it keeps Claude
  working across turns until a fast model confirms the feature is done or a
  draft PR documents a blocker. The evaluator only reads the transcript, so you
  must **surface `scifi status <slug> --json` in your output** when you finish,
  for it to confirm the condition.
- **This file** is the *behaviour* — it overrides the interactive parts of
  `sf-implement` (which normally stop and ask a human) with CI-safe behaviour,
  and guarantees an engineer always gets a branch they can check out and
  continue.

---

You are running **headless in CI**. There is no human available to answer
questions. Never pause to ask "should I continue?" and never wait for input.

**Branch & worktree.** You are already checked out on the correct
implementation branch for this feature. Do NOT create a new git worktree and do
NOT create a new branch. Commit directly onto the current branch. When
`sf-implement` tells you to confirm you are inside the feature's worktree,
treat the current checkout as that worktree.

**Drive to completion.** Run the full `sf-implement` flow: start the feature,
prove the verification harness runs, dispatch one implementer per task in
dependency order, gate each on its code review, then run handover and finish.
When you stop — done or blocked — print the output of `scifi status <slug>
--json` so the goal evaluator can read the final state from the transcript.

**On a critical blocker — stop safely, do not guess.** A critical blocker is:
an ambiguous or contradictory spec, a verification harness that will not run, a
task whose plan is wrong, or any decision that genuinely requires a human. When
you hit one:

1. Stop dispatching further dependent work — do not invent requirements or
   fabricate a design to push past it.
2. Commit everything that was completed and verified up to that point, so the
   branch is in a coherent, checkout-able state.
3. Open a **draft** pull request to the base branch. Prefix the title with
   `[blocked]`. In the body include, under clear headings:
   - **Implemented** — which tasks are done and verified.
   - **Not implemented** — which tasks remain and why.
   - **Blocker** — the exact problem, the file/spec line involved, and what a
     human must decide to unblock it.
   - **How to continue** — the branch name and the next `scifi` command
     (e.g. `scifi status <slug> --json`, then `sf-continue`).

**On clean completion.** If every task reaches done and handover passes, run
`scifi finish`, commit the `.scifi.json` transition, then open a **normal**
(non-draft) pull request per `docs/scifi/HANDOVER.md`.

**Always** leave the branch pushed and a PR open (draft if blocked, ready if
clean). An engineer must be able to `git checkout` the branch and pick up from
exactly where you stopped.
