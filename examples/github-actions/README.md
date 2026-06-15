# Autonomous `sf-implement` on GitHub Actions

A reference CI setup that turns a **merged, plan-ready spec** into an
**implemented pull request** with no human at the keyboard.

The human-judgement stages of scifi (`sf-feature`, `sf-plan`, and the spec/plan
reviews) stay local and interactive. This example only automates the stage that
is derived deterministically from frozen artifacts — implementation — and leaves
the result behind a normal PR review.

> **This is a reference, not a hardened pipeline.** It runs an agent
> autonomously with permission prompts disabled. Read the *Blast radius* section
> before enabling it on a repository you care about.

## Flow

1. A reviewed spec reaches `plan-ready` locally and is merged to `main`.
2. On push to `main`, `detect-plan-ready.sh` diffs the merged range, finds
   feature slugs whose files changed, and keeps the ones `scifi status` reports
   as `plan-ready`.
3. For each, the workflow cuts a `sf-impl/<slug>` branch and runs
   `claude -p "/sf-implement <slug>"` headlessly.
4. The run drives the full TDD + per-task code-review + handover pipeline and
   opens a PR back to `main`:
   - **clean run →** ready (non-draft) PR per `docs/scifi/HANDOVER.md`;
   - **blocked run →** `[blocked]` **draft** PR documenting what was done, what
     was not, the exact blocker, and how to continue.

## Files

| File | Role |
| --- | --- |
| `.github/workflows/sf-implement.yml` | The workflow: detect → branch → run → ensure PR. |
| `scripts/detect-plan-ready.sh` | Diffs the merged range, prints `plan-ready` slugs. |
| `ci-goal.md` | The headless guardrail injected via `--append-system-prompt`. |

Copy them into the target repo (keep `ci-goal.md` and `scripts/` next to the
workflow, or adjust the paths the workflow references).

## `/goal` + the behaviour directive (`ci-goal.md`)

Two complementary mechanisms wrap the skill. Both run in the single headless
`claude -p` invocation in the workflow's *Run sf-implement headlessly* step.

**`/goal` — the completion loop.** A plain `claude -p "/sf-implement <slug>"`
returns after the first turn. `/goal` sets a completion condition and a fast
model re-checks it after every turn; until it holds, Claude keeps working. The
workflow sets the condition to "feature reports `done` with a ready PR, or a
`[blocked]` draft PR documents the blocker; stop after N turns." Because the
evaluator **only reads the transcript** (it does not run commands), the agent
must surface `scifi status <slug> --json` in its output — `ci-goal.md` tells it
to.

**`ci-goal.md` — the behaviour.** `sf-implement` is built to **stop and ask a
human** on an ambiguous spec, a broken harness, or a wrong plan. Headless there
is no human. Injected as an appended system prompt, this file overrides that
path:

- never pause for input; you are already on the right branch (don't make a
  worktree);
- on a critical blocker, **stop, commit what is safely done, and open a draft
  PR** that documents the blocker and how to continue;
- on clean completion, finish and open a ready PR.

So `/goal` decides *when to stop*; `ci-goal.md` decides *how to behave*.

## Setup

**Prerequisites in the target repo**

- `scifi init` has been run and the **scifi skills are committed** (the headless
  run resolves `/sf-implement` from the repo's `.claude/skills`). Without them
  the skill cannot load.
- A `docs/scifi/HANDOVER.md` whose finishing actions push the branch and open
  the PR (the workflow's *Ensure a PR exists* step is only a safety net).
- **`/goal` requires Claude Code ≥ 2.1.139, a trusted workspace, and hooks
  enabled** (it is implemented as a session-scoped Stop hook). It is unavailable
  under `disableAllHooks` or `allowManagedHooksOnly` — ensure neither is set in
  the runner's settings, and that the checkout is trusted.

**Secrets** (repo → Settings → Secrets and variables → Actions)

| Secret | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Authenticates the headless Claude Code run. |
| `GITHUB_TOKEN` | Provided automatically; the workflow grants it `contents: write` + `pull-requests: write` for branch push and PR creation. |

To let the bot's PRs trigger your normal CI, use a PAT / GitHub App token
instead of the default `GITHUB_TOKEN` (default-token pushes don't trigger
further workflow runs).

## Blast radius — read before enabling

- **Permissions are bypassed.** The run uses `--permission-mode
  bypassPermissions` because no human can approve tool calls. The agent can run
  arbitrary commands on the runner. Mitigations: it works on a throwaway
  `sf-impl/<slug>` branch, never on `main`; output is gated by the PR review;
  prefer an ephemeral or self-hosted runner you are comfortable giving an agent.
- **Cost and time.** A full feature is many subagent turns and real token spend.
  `--max-turns` caps a runaway run; the matrix runs features in parallel. Budget
  accordingly and consider a self-hosted runner over the 6-hour hosted ceiling.
- **`plan-ready` is not a guarantee.** A clean plan can still hit decisions
  mid-implementation. The draft-PR-on-blocker path is the expected, healthy
  outcome for those — an engineer checks out the branch and continues with
  `sf-continue`.
- **Idempotency.** The workflow skips a slug whose `sf-impl/<slug>` branch
  already exists upstream, so re-merges and re-runs don't open duplicate PRs.

## Limitations

- Pinned to the `docs/scifi/specs/<slug>/` layout and the `main` default branch;
  adjust both for other conventions.
- No retry/backoff on API errors beyond the turn cap.
- Assumes the project's verification harness installs and runs on a stock
  `ubuntu-latest` Node 20 runner — add system deps as your project needs.
