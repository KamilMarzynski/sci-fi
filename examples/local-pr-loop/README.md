# Babysit spec PRs and implement on approval — local `/loop`

A reference for running one Claude Code `/loop` session that **watches your own
open spec PRs**, answers review comments on them, and — once a PR is clean and
approved — **implements it**. One session babysits several PRs at once: it
dispatches one background subagent per PR, each in its own local git worktree, so
the work runs in parallel without sharing a tree.

It is the PR-driven sibling of the other two examples. Where they act on a spec
*after* it merges to `main`, this one acts on the **open PR** that carries the
spec — the review and the implementation both happen on that one PR.

> **Reference, not a hardened pipeline.** It runs agents unattended that edit your
> spec from human comments and then implement it. That is higher-autonomy than the
> merge-triggered examples — read *Blast radius* before enabling it.

## How it compares

|                     | This example (`local-pr-loop`)          | `local-loop`                     | `github-actions`                |
| :------------------ | :-------------------------------------- | :------------------------------- | :------------------------------ |
| Trigger             | Your **open** spec PR                   | Spec **merged** to `main`        | Spec **merged** to `main`       |
| Does review-response| Yes — `sf-receiving-review` on comments | No                               | No                              |
| Approval gate       | 👍 reaction on the PR                    | (none — merge is the gate)       | (none — merge is the gate)      |
| Concurrency         | Parallel — one background agent per PR  | Serial, one feature per iteration| Matrix, parallel per slug       |
| Result lands        | On the **same** PR (spec → spec+impl)   | New PR                           | New PR                          |
| Runs                | Your machine, session open              | Your machine, session open       | Unattended CI                   |

## Flow

1. Locally you run `sf-feature` + `sf-plan`, reach `plan-ready`, and open a PR with
   the spec — **without merging**. Reviewers comment on the PR.
2. In a `main` checkout you run `/loop 10m @LOCAL_PR_LOOP.md` in one long-lived
   session.
3. Each iteration the loop lists your open spec PRs and, for each, reads the
   feature status from the PR branch and inspects its review state — all read-only
   over `gh`.
4. **If the PR has unresolved review threads,** it dispatches a background subagent
   running `/sf-receiving-review`: the subagent fixes `spec.md`/`design.md` (or
   pushes back), replies, resolves the threads it handled, and pushes — all in an
   isolated worktree. It does **not** implement.
5. **If the PR has no unresolved threads and a 👍,** it dispatches a background
   subagent running `/sf-implement` on that same branch. Implementation commits
   land on the existing PR, turning it from a spec PR into a spec+implementation
   PR. No new PR is opened.
6. The loop stays responsive throughout, cycling every 10 minutes and servicing
   other PRs while the long implementations run detached.

## Why this shape works

- **Parallel is safe because of worktrees.** The only hard serialization rule is
  *within one feature* — `sf-implement` keeps its own implementers serial because
  they share a tree. Across **different** PRs, each subagent gets its **own**
  `git worktree` (its own directory and branch), so there is no shared tree and
  they run concurrently without conflict.
- **Background, not foreground.** Each per-PR agent is dispatched in the
  background so a multi-hour implementation does not freeze the poller. The loop
  returns quickly, the 10-minute cron keeps cycling, and the harness re-invokes
  the loop when a background agent finishes. Depth is fine:
  `loop → per-PR agent → implementer → reviewer` stays under the background
  subagent depth cap, so the nested implementer/reviewer still spawn.
- **The owner's 👍 is a valid approval.** A solo dev who reviews and accepts their
  own spec is the intended case, so the author's own thumbs-up counts. For a
  stricter gate, require the 👍 from a non-author, or switch to GitHub's native
  **Approve** review state.

## Gates and idempotency

Two durable markers keep the loop from doubling up across iterations and restarts:

- **Lifecycle status on the PR branch.** Once implementation starts,
  `scifi start` moves the feature `plan-ready → in-progress` and that transition is
  committed to the PR branch. The loop reads `.scifi.json` at the PR head and skips
  anything not `plan-ready`.
- **Resolved thread state.** A handled comment is resolved via the
  `resolveReviewThread` mutation; the next iteration sees it resolved and ignores
  it. Threads left open with a question are *meant* to persist — they are waiting
  on a human.

Within a session the loop also skips any PR it already has a live background agent
for. For a guard that survives a poller restart mid-implementation, add a PR label
lock (see *Limitations*).

## Skills' human-escalation, redirected

Both skills are built to **stop and ask a human**; unattended there is none, so the
prompt redirects each — and the two redirects are deliberately different:

- **`sf-implement`** — *"surface BLOCKED to the user."* Redirected to: commit what
  is verified, push, and leave a `[blocked]` comment on the PR. (Same as the other
  examples.)
- **`sf-receiving-review`** — *"if any item is unclear, STOP and ask"* and *"surface
  architectural disagreements to the user."* Redirected to: **reply on the thread
  with the question and leave it unresolved** — never guess. This is the important
  one: the skill edits `spec.md`, the contract everything downstream is built from,
  so a misread comment must surface as a question, not a silent rewrite.

## How to run

From a clean checkout on `main`, with `LOCAL_PR_LOOP.md` at the repo root and `gh`
authenticated as the PR author:

```bash
claude --permission-mode acceptEdits
```

```text
> /loop 10m @LOCAL_PR_LOOP.md
```

Leave the terminal open: `/loop` fires only while the session is running and idle.
Stop it with `Esc`; it also expires after 7 days (re-run to continue).

## Requirements

- **scifi initialised with skills committed**, and a `docs/scifi/HANDOVER.md` —
  the implement subagent resolves `/sf-implement` and `/sf-receiving-review` from
  the repo's `.claude/skills`.
- **`gh` authenticated as the PR author** with `repo` scope — the loop reads PRs,
  threads, and reactions, and the subagents push branches and resolve threads.
- **Engine ≥ 2.1.172** — for nested subagents (the implementer spawns its own
  reviewer) and for stable background-agent dispatch.
- **Same-repo PRs.** The worktree setup assumes the PR branch is in this repo
  (your own PRs), not a fork.

## Blast radius — read before enabling

- **It edits your spec autonomously.** `sf-receiving-review` changes `spec.md`/
  `design.md` in response to human comments. The ambiguity→ask redirect keeps it
  from guessing, but review the pushes — this is the contract.
- **Relaxed permissions.** For hands-off operation the session runs with
  `acceptEdits`/`bypassPermissions`; the agents act without per-tool approval.
  Everything stays on PR branches, never on `main`, and is gated by your review and
  the 👍.
- **Cost scales with PR count.** N PRs means up to N implementations in flight,
  each many subagent turns. Watch the spend; the poller runs for up to 7 days.
- **Approval is as strong as your 👍 discipline.** Since the author's own 👍 fires
  implementation, a stray reaction starts real work. Use the stricter gate
  (non-author 👍 or native Approve) if that worries you.

## Limitations

- **No restart-proof lock.** Mid-implementation, the in-flight guard lives in the
  session; a poller restart before the `in-progress` transition is pushed could
  re-dispatch. Add a PR label (e.g. `scifi:working`, set on dispatch, cleared on
  finish) for a durable lock if you need one.
- **Scope is spec/plan review → implement.** Once implementation lands, new
  *code*-review comments on the PR are left to humans and the per-task review
  inside `sf-implement`; the loop does not route post-implementation code review.
- **Lens detection is heuristic** — threads on `spec.md` use the spec lens, on
  `design.md`/`tasks/` the plan lens. Mixed threads may need a human.
- **A reference, not a turnkey pipeline.** Every primitive is supported — `/loop`,
  background subagents, isolated worktrees, `gh` reactions and GraphQL review
  threads, `sf-receiving-review` and `sf-implement` — and is meant to be read and
  adapted to your own review conventions rather than run unchanged.
