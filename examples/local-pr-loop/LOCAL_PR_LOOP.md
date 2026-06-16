<!--
  Loop prompt for babysitting your own scifi spec PRs and implementing them once
  they are reviewed and approved. Invoke it from a checkout on `main` with:

      /loop 10m @LOCAL_PR_LOOP.md

  One session watches several PRs at once: it answers review comments with
  sf-receiving-review and, when a PR is clean and approved, dispatches
  sf-implement — each in its own background subagent and its own local git
  worktree, so the work runs in parallel without sharing a tree. The README
  explains the design, the gates, and the skills' assumptions. Everything below
  the comment is the prompt sent to the model each iteration.
-->

You babysit the **open pull requests you authored** that carry a scifi spec, and
move each one forward: answer review comments, and once a PR is clean and
approved, implement it. You are the lightweight dispatcher — the actual work runs
in **background subagents**, one per PR, each in its own git worktree. Keep your
own context small: inspect with `gh` here, mutate only inside the subagents.

Run the steps below once per iteration, then end with a one-line summary per PR.

## 1. Find your spec PRs

```
me=$(gh api user --jq .login)
gh pr list --author "@me" --state open --json number,headRefName,title
```

For each PR, find the feature it carries: list its changed files and keep the
slug under `docs/scifi/specs/<slug>/`.

```
gh pr diff <number> --name-only \
  | sed -n 's#^docs/scifi/specs/\([^/]*\)/.*#\1#p' | sort -u
```

If a PR touches no `docs/scifi/specs/<slug>/`, it is not a spec PR — skip it.

## 2. Read the feature's status from the PR branch

The spec is **not on `main`**, so do not run `scifi status` locally — read the
committed metadata at the PR head instead (top-level `status` field):

```
gh api "repos/$me/<repo>/contents/docs/scifi/specs/<slug>/.scifi.json?ref=<headRefName>" \
  -H "Accept: application/vnd.github.raw" | jq -r '.status'
```

Only act on PRs whose status is `plan-ready` (spec + plan frozen, awaiting
review). A status of `in-progress` or `done` means implementation already started
on this PR — skip it (that is your idempotency guard; the transition is committed
to the PR branch).

## 3. Skip anything already in flight

Skip a PR if **you already have a live background subagent for it** (you tracked
it when you dispatched). Never run two agents against the same PR. Combined with
the status check above, this stops duplicate work across iterations and restarts.

## 4. Inspect review state (read-only)

**Unresolved review threads** — needs GraphQL; REST does not expose resolution:

```
gh api graphql -f query='
  query($owner:String!,$repo:String!,$number:Int!){
    repository(owner:$owner,name:$repo){
      pullRequest(number:$number){
        reviewThreads(first:100){ nodes{ id isResolved path comments(first:50){ nodes{ body author{login} } } } }
      }
    }
  }' -F owner=$me -F repo=<repo> -F number=<number>
```

Count nodes where `isResolved == false`.

**Approval (👍)** — a top-level thumbs-up reaction on the PR is the go signal. The
author's own 👍 counts: a solo dev reviewing and accepting their own spec is a
valid approval here.

```
gh api "repos/$me/<repo>/issues/<number>/reactions" \
  --jq '[.[] | select(.content=="+1")] | length'
```

## 5. Decide and dispatch (one background subagent per PR)

- **Unresolved threads exist →** dispatch a **background** subagent to answer the
  review. Do NOT implement yet. Task:

  > Address the review on PR #<number> for scifi feature `<slug>` (status
  > plan-ready). Set up an isolated worktree: `git fetch origin`, then
  > `git worktree add .worktrees/<headRefName> <headRefName>` and `cd` into it.
  > Run `/sf-receiving-review` with the **spec lens** for threads on `spec.md` and
  > the **plan lens** for threads on `design.md`/`tasks/`. For each unresolved
  > thread: verify the finding against the spec/plan, then either fix it (edit the
  > spec/plan, never source) or push back with a technical reason. Reply on the
  > thread with the outcome and **resolve only the threads you confidently
  > addressed** (`resolveReviewThread` mutation with the thread `id`). **If a
  > comment is ambiguous, reply asking the specific question and LEAVE the thread
  > unresolved — never guess on the contract.** Commit the spec/plan edits and
  > `git push` to `<headRefName>`. Do not open a new PR, do not change lifecycle
  > status. Finish by printing how many threads you resolved and how many you left
  > open with a question.

- **No unresolved threads AND a 👍 is present →** dispatch a **background**
  subagent to implement. Task:

  > Implement scifi feature `<slug>` on its existing PR #<number>, branch
  > `<headRefName>`. Set up an isolated worktree: `git fetch origin`, then
  > `git worktree add .worktrees/<headRefName> <headRefName>`, `cd` into it, and
  > record it (`scifi worktree set <slug> --branch <headRefName> --path <path>`).
  > Run `/sf-implement <slug>` and drive the full flow to completion — you are
  > unattended, never pause to ask. **This PR already exists: push implementation
  > commits to `<headRefName>` and do NOT open a new PR**; when `HANDOVER.md` would
  > open one, skip that step. On clean completion run `scifi finish`, commit the
  > `.scifi.json` `done` transition, and push. On a critical blocker (ambiguous
  > spec, harness will not run, wrong plan) stop, commit what is verified, push,
  > and leave a comment on PR #<number> under headings **Implemented** /
  > **Not implemented** / **Blocker** / **How to continue**. Finish by printing
  > `cat docs/scifi/specs/<slug>/.scifi.json` so the final status is visible.

- **Otherwise →** nothing to do; the PR is waiting on a reviewer or on approval.

## 6. Summarize

End with one line per PR: skipped (and why), review-subagent dispatched, or
implement-subagent dispatched. Never commit to `main`. Never run two subagents
against one PR.
