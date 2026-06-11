# sf-feature

You run a grilling session for ONE feature. The session ends with a written
`spec.md` and the feature marked spec-ready. This is spec creation only — no
plan, no code.

The skill is inspired by hard, friendly grilling: you interrogate the idea
until it is unambiguous, confronting it against what the project already is.

## Long-term memory

Before grilling, read `docs/scifi/CONTEXT.md` (if present) — the project's
ubiquitous language: the canonical glossary of domain terms. Use it to keep
naming consistent. When the feature introduces a new domain term, define it in
`CONTEXT.md` and apply the edit live once the user approves.

For prior architectural decisions, see "Architecture Decision Records" below —
grep them on demand rather than reading one big doc up front.

## Architecture Decision Records

Decisions live in `docs/scifi/adr/` as numbered records `NNNN-slug.md`. The
directory is lazy — it does not exist until the first record.

- **Read on demand.** When the feature touches an area that may already carry a
  recorded decision, grep `docs/scifi/adr/` for relevant keywords — the same
  instinct as grepping the codebase while grilling. Do not contradict a recorded
  decision without surfacing it to the user.
- **Write sparingly.** Record an ADR only when ALL THREE hold:
  1. Difficult reversal — meaningful cost to changing course later.
  2. Non-obvious rationale — a future reader will question the choice.
  3. Genuine trade-offs — real alternatives existed; one was chosen deliberately.
  A routine, obvious, or easily-reversed choice gets no ADR.
- **Numbering.** Run `ls docs/scifi/adr/` and take `max + 1`, zero-padded (e.g.
  `0007`). If the directory is absent, start at `0001` and create it. Copy
  `ADR-TEMPLATE.md` (ships beside this skill) into the new file and fill it.

## Flow

### 1. Name and create (or reopen) the container

**If you were sent here to resume or reopen an existing feature** — by
`sf-continue` on a `created` feature, or by `sf-change` rolling a feature back to
the spec stage — the container already exists. Do **not** run `scifi spec`; it
would `CONFLICT`. Confirm the feature with `scifi status <slug> --json`; its
worktree is reported as `worktree` (fallback: `.worktrees/feat-<slug>`). Enter
that worktree and go straight to grilling against the spec that is already
there. Skip the rest of this step.

**Otherwise, for genuinely new work,** create the container:

- Derive a short kebab-case slug from the request (e.g. `google-auth`).
- If the user pasted an issue reference instead of a description — an issue
  number, a URL, a Jira ticket, anything — resolve it however is appropriate
  for that tracker to recover the actual request, then derive the slug.
- **Create the feature's branch and worktree (this is automatic now).** From the
  repository's default/integration branch, run (the commands below show it as
  `main` — substitute your repo's actual default branch if it differs):

  ```
  git worktree add -b feat/<slug> .worktrees/feat-<slug> main
  ```

  This gives the feature an isolated workspace so several features can be in
  flight at once without colliding. Work from inside `.worktrees/feat-<slug>`
  for the rest of this skill and for planning and implementation. If the path
  already exists, the feature was started before — treat this as the reopen case
  above instead of creating a second worktree.
- Create the container:

  ```
  scifi spec <slug> --title "<human title>" --json
  ```

  - `<slug>` is the kebab-case folder name. `--title` is optional prose.
  - `--json` gives you a structured result. Read `path` from it — that is the
    feature directory. Your spec goes at `<path>/spec.md`.
  - On success the status is `created`.
  - If it errors with `CONFLICT`, the slug already exists. If you meant to start
    new work, pick a different slug; do not overwrite. If you actually meant to
    revise that feature, this is the reopen case above — work against the
    existing `<path>` instead of creating.
- Record the workspace on the feature so status and resume can find it:

  ```
  scifi worktree set <slug> --branch feat/<slug> --path .worktrees/feat-<slug>
  ```
- Tell the user the slug you picked and the path.

### 2. Grill (this is the real work)

Interrogate until you can fill EVERY section of the spec template with no
gaps. Do not write the spec before then.

- One question at a time. Prefer concrete either/or questions.
- Confront the idea against the codebase and any relevant ADRs (grep
  `docs/scifi/adr/`). If it contradicts a recorded decision or existing
  structure, surface it.
- Drive toward: the real problem, what is explicitly out of scope, testable
  acceptance criteria, the edge cases that will bite, and which modules the
  work touches.
- When you hit a new domain term, propose the `CONTEXT.md` edit and apply it
  once the user agrees. When the grilling settles a hard, non-obvious
  architectural decision, record an ADR (see above).

You are convinced when every template section below has a real answer, not a
placeholder.

### 3. Write the spec

- Copy `SPEC-TEMPLATE.md` (ships beside this skill) into `<path>/spec.md` —
  where `<path>` is the directory returned by `scifi spec` — and fill every
  section from the grilling.
- No `TBD` / `TODO` left behind. Unresolved items go under "Open questions",
  not scattered as placeholders.

### 4. Review loop (gate)

- Dispatch the review subagent using `DISPATCH-SPEC-REVIEW.md` (ships beside
  this skill), filling in the spec path.
- Process its report with the `sf-receiving-review` skill, passing **review
  type: spec**. That skill governs how you act on the findings.
- Re-dispatch until the verdict is **Pass** or **With fixes**; a **Fail**
  re-loops. On **With fixes**, address the Minor items (or defer them with the
  user's ok) before finalizing. Do not skip this.

### 5. Finalize

- Only after the review passes, run:

  ```
  scifi spec-ready <slug> --json
  ```

  - This validates that `<path>/spec.md` exists and transitions the feature
    `created → spec-ready`.
  - If it errors with `PRECONDITION_FAILED` (spec.md missing), you put the spec
    in the wrong place — write it to `<path>/spec.md` and retry.
- This is the end of spec creation. Planning happens later via `sf-plan`.

## Hard rules

- Never run `scifi spec-ready` before `sf-spec-review` passes.
- Never write `spec.md` while any template section is still unanswered.
- Never invent project facts — read the docs or ask.
