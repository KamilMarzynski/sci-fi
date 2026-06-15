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
   `/loop 10m` (with `.claude/loop.md` in place — see below).
3. Each iteration the session pulls `main`, runs
   `scifi list --status plan-ready --json`, and for every plan-ready slug not
   already in progress dispatches a subagent running `/sf-implement <slug>`.
4. The subagent drives TDD + per-task review + handover and opens a PR — a ready
   PR on clean completion, a `[blocked]` draft PR documenting the blocker
   otherwise.
5. Starting an implementation moves the slug off `plan-ready`, so the next
   iteration will not pick it up again.

## Files

| File | Role |
| --- | --- |
| `loop.md` | The loop prompt. Copy to **`.claude/loop.md`** in the target repo. |

Only one file to copy. Detection is a single CLI call, so there is no script to
ship — `scifi list --status plan-ready --json` already filters by status across
the checkout and any linked worktrees.

## How to run

From a clean checkout of the target repo, on `main`:

```bash
# 1. Put the loop prompt where /loop reads it.
mkdir -p .claude && cp path/to/examples/local-loop/loop.md .claude/loop.md

# 2. Start a session that may act without per-tool prompts, then start the loop.
claude --permission-mode acceptEdits
```

```text
> /loop 10m
```

`/loop` inherits the session's permission mode, so for hands-off operation start
`claude` with `--permission-mode acceptEdits` (or `--dangerously-skip-permissions`
if you accept the *Blast radius* below). Leave the terminal open: the loop only
fires while the session is running and idle.

**Stop it** with `Esc` while it is waiting for the next iteration. It also stops
on its own after the 7-day cron expiry; re-run `/loop 10m` to continue past that.

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
- **Unverified end to end.** The pieces are individually supported — `/loop` on a
  fixed interval, `.claude/loop.md`, `scifi list --status`, subagents running
  skills, nested subagents (≥ 2.1.172) — but this specific combination has not
  been run for real. Validate on a throwaway repo first: confirm a plan-ready slug
  is detected, the subagent spawns and runs `/sf-implement`, and its reviewer
  subagent spawns rather than falling back to `REVIEW_UNAVAILABLE`.
