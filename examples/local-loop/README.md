# Autonomous `sf-implement` with a local `/loop`

A reference for running `sf-implement` autonomously on **your own machine**: a
Claude Code session polls `main` every 10 minutes, and whenever a freshly merged
spec is sitting at `plan-ready`, it dispatches a subagent that implements it and
opens a PR.

This is the **local, attended** sibling of [`../github-actions`](../github-actions).
Same end goal — a merged plan-ready spec becomes an implemented PR with no human
typing — but the persistence layer is `/loop` in an open session instead of a CI
workflow, and detection uses the CLI directly instead of a git-range diff.

> **Reference, not a hardened pipeline.** It runs an agent unattended with
> permission prompts relaxed. Read *Blast radius* before pointing it at a repo
> you care about.

## How it differs from the CI example

|                          | This example (`/loop`)                          | CI example (`github-actions`)                 |
| :----------------------- | :---------------------------------------------- | :-------------------------------------------- |
| Runs on                  | Your machine, **session must stay open**        | GitHub-hosted runner, unattended              |
| Persistence layer        | `/loop` (session-scoped cron, 7-day expiry)     | `push` trigger + the `/goal` completion loop  |
| Detect plan-ready        | `scifi list --status plan-ready --json`         | `git diff` of the merged range → `scifi status` |
| Worktree / branch        | Native — `sf-implement` makes its own worktree  | Forced onto a prepared `sf-impl/<slug>` branch |
| Parallelism              | Serial, one feature per iteration               | Matrix, features in parallel                  |
| Trust / headless runtime | Your already-trusted local session              | `anthropics/claude-code-action`               |

## `/loop`, not `/goal` — and no `/goal` inside the subagent

The original sketch was "loop dispatches a subagent that runs `sf-implement`
wrapped in `/goal`." That nests two control structures that are meant as
alternatives. The docs present `/loop` (re-run on an interval) and `/goal` (keep
the session working until a condition holds) as *different* answers to "how do I
keep going." Here:

- **`/loop` is the persistence layer** — it does locally what `/goal` does in the
  CI example: keep coming back until the work is done. A fixed interval
  (`/loop 10m`) maps to a cron job; a bare `/loop` self-paces.
- **The subagent runs `/sf-implement` directly** — `sf-implement` is *already* a
  to-completion orchestrator (it dispatches one TDD implementer per task, gates
  each on a code review, then handover + finish). A subagent dispatched via the
  Agent tool runs its task in one shot and returns, so there is nothing for a
  per-subagent `/goal` loop to do. Wrapping it in `/goal` would add a mechanism
  that does not fit how subagents return.
- **Why a subagent at all:** context isolation. A `/loop` can run for up to 7
  days; keeping each multi-hundred-turn implementation in its own subagent stops
  the poller's own context from ballooning across iterations.

## Flow

1. A reviewed spec reaches `plan-ready` locally and is merged to `main`.
2. In a checkout of the repo, you start one long-lived Claude Code session and run
   `/loop 10m @LOCAL_IMPL_LOOP.md`.
3. Each iteration the session pulls `main`, runs
   `scifi list --status plan-ready --json`, and for every plan-ready slug not
   already in progress dispatches a subagent. The subagent `cd`s into the
   feature's worktree and runs `/sf-implement <slug>`.
4. The subagent drives TDD + per-task review + handover and opens a PR — a ready
   PR on clean completion, a `[blocked]` draft PR documenting the blocker
   otherwise.
5. Starting an implementation moves the slug off `plan-ready`, so the next
   iteration will not pick it up again.

## Files

| File | Role |
| --- | --- |
| `LOCAL_IMPL_LOOP.md` | The loop prompt. Pass it to `/loop` with an `@`-mention. |

Only one file. Detection is a single CLI call, so there is no script to ship —
`scifi list --status plan-ready --json` already filters by status across the
checkout and any linked worktrees.

## How to run

From a clean checkout of the target repo, on `main`, with `LOCAL_IMPL_LOOP.md` at
the repo root:

```bash
# Start a session that may act without per-tool prompts.
claude --permission-mode acceptEdits
```

```text
> /loop 10m @LOCAL_IMPL_LOOP.md
```

The `@`-mention passes the file's contents as the loop prompt. `/loop` inherits
the session's permission mode, so for hands-off operation start `claude` with
`--permission-mode acceptEdits` (or `--dangerously-skip-permissions` if you accept
the *Blast radius* below). Leave the terminal open: the loop only fires while the
session is running and idle.

> The `@`-mention is expanded when you issue the command, so the prompt is
> snapshotted once — re-issue `/loop` after editing the file. If you want a prompt
> that reloads every iteration instead, put the same body at `.claude/loop.md` and
> run a bare `/loop 10m`; that path is auto-read and re-read each iteration.

**Stop it** with `Esc` while it is waiting for the next iteration. It also stops
on its own after the 7-day cron expiry; re-run `/loop 10m` to continue past that.

## Fitting the `sf-implement` skill (what the prompt has to handle)

`sf-implement` is built to run autonomously — *"Run continuously, do not stop to
ask between tasks. Stop only for a BLOCKED you cannot resolve, a genuine
ambiguity, or all tasks done."* So the loop's "never pause" instruction reinforces
the skill rather than fighting it, and the most dangerous path — a verification
harness that will not run — the skill already hard-stops on itself. But three of
its assumptions need the prompt's help, which is why `LOCAL_IMPL_LOOP.md` is more
than "run `/sf-implement`":

- **It expects to start inside the feature's worktree, and the recorded path may
  not be local.** The skill confirms it is inside the worktree `sf-feature`
  created, reading the `worktree` path from `scifi status`; it does **not** create
  one. That path is recorded with `scifi worktree set` at authoring time and
  **committed into the spec**, so it points at the machine where the spec was
  written — it only exists here if this is that machine. The dispatched subagent
  is therefore told to `cd` into the recorded worktree when it exists, and
  otherwise create one for the feature branch on this machine
  (`git worktree add` + `scifi worktree set`) before running `/sf-implement` —
  never to work in the `main` checkout.

  > **This is a current limitation worth stating plainly.** scifi records an
  > absolute worktree path so the *local* author gets seamless resume
  > (`sf-continue` lands back in the same worktree). The cost is that any *other*
  > machine — this loop on a teammate's merge, or the CI runner in the sibling
  > example — must not trust that path and has to re-establish a worktree itself.
  > Until scifi resolves the worktree relative to the current checkout, every
  > autonomous, off-author-machine setup has to account for this explicitly, as
  > this prompt does.
- **Handover has a second ask-the-human gate.** When handover finds untracked
  workflow artifacts (the spec dir, new ADRs, `CONTEXT.md` edits) it asks the user
  how to handle each. Unattended there is no user, so the prompt sets a default:
  commit them with the feature so the branch is self-contained.
- **Blocker escalation is redirected, not removed.** Where the skill would escalate
  a genuine blocker to the user, the prompt sends it to a `[blocked]` draft PR
  instead — same "stop, do not guess" intent, different destination.

This is also where the example is most likely to need tuning on a real run: an
agent told to "drive to completion" can lean on the skill's *re-dispatch* and
*split-the-task* recovery steps longer than it should before concluding a slug is
genuinely blocked. The turn budget and your review of the resulting PRs are the
backstop.

## Requirements

- **scifi initialised with skills committed.** The subagent resolves
  `/sf-implement` from the repo's `.claude/skills`, and a
  `docs/scifi/HANDOVER.md` whose finishing actions push the branch and open the
  PR. Without these the implementer cannot run or cannot publish its result.
- **Subagents can use skills.** The loop dispatches a subagent that invokes the
  `/sf-implement` skill; this is the standard Claude Code behaviour, but verify it
  on your engine before trusting an unattended run.
- **Engine ≥ 2.1.172 for nested subagents.** `sf-implement`'s implementer spawns
  its own code-review subagent, which — dispatched from the loop's subagent — is
  several levels deep. Foreground subagents can spawn at any depth as of v2.1.172;
  on an older engine the reviewer falls back to `REVIEW_UNAVAILABLE` and the
  orchestrator runs the gate itself (still correct, not the designed path).
- **`/loop` needs scheduled tasks enabled** (Claude Code ≥ 2.1.72; do not set
  `CLAUDE_CODE_DISABLE_CRON=1`).

## Blast radius — read before enabling

- **Relaxed permissions.** For unattended operation the session runs with
  `acceptEdits` or `bypassPermissions`, so the agent acts without approving each
  tool call. It works on `sf-implement`'s own worktree/branch, never editing
  `main` beyond a fast-forward pull, and every result is gated by a PR review —
  but treat the machine as one you are comfortable letting an agent drive.
- **Cost and time.** Each feature is many subagent turns and real token spend, and
  the loop keeps polling for up to 7 days. Run it on `main` checkouts where
  plan-ready specs actually land, and stop it (`Esc`) when you are done.
- **`plan-ready` is not a guarantee.** A clean plan can still hit a decision
  mid-implementation; the `[blocked]` draft PR is the expected healthy outcome —
  check out the branch and continue with `sf-continue`.
- **Session must stay up.** Closing the terminal or starting a fresh conversation
  stops the loop. Resuming with `claude --resume` restores an unexpired loop. For
  truly unattended scheduling, use the CI example instead.

## Limitations

- Pinned to the `main` default branch and the standard scifi layout; adjust the
  pull target and status filter for other conventions.
- Serial by design — one feature per iteration. Raise throughput by shortening the
  interval, not by parallel dispatch (parallel subagents on one machine multiply
  the resource and token cost).
- **A reference, not a turnkey pipeline.** The building blocks are individually
  supported — `/loop` on a fixed interval, an `@`-mentioned prompt file,
  `scifi list --status`, subagents running skills, nested subagents
  (≥ 2.1.172) — and are meant to be read and adapted to a repo's own conventions
  rather than run unchanged.
