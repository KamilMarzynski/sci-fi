<p align="center">
  <img src="./assets/icon.png" alt="Sci-Fi logo" width="160" />
</p>

<h1 align="center">Sci-Fi</h1>
<p align="center">specification-driven development framework</p>

<p align="center">
  <a href="https://github.com/KamilMarzynski/sci-fi/actions/workflows/ci.yml"><img src="https://github.com/KamilMarzynski/sci-fi/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg" alt="Node.js" /></a>
</p>

> **Inspired by** the great prior art in agent skills and spec-driven workflows —
> [mattpocock/skills](https://github.com/mattpocock/skills),
> [obra/superpowers](https://github.com/obra/superpowers), and
> [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec). Credit where it's due.

`Sci-Fi` is a specification-driven workflow for building software with a coding
agent. It gives a feature a lifecycle — *spec → plan → implement → done* — and
holds every stage to a written artifact and a review gate before it can advance.

It is two cooperating layers:

- A small **CLI** (`scifi`) that tracks each feature's lifecycle on disk and
  gates every advance on its backing artifact.
- A set of bundled **skills** (`sf-*`) that your agent runs to do the actual
  work — interrogating the idea, writing the spec, planning the design,
  implementing it test-first, and reviewing each step.

The CLI is the bookkeeping; the skills are the method. The CLI never refuses to
let the agent advance unless an artifact is genuinely missing, and the skills
never advance the lifecycle until a review has passed.

> **On the name:** originally `spec-flow` (`sf` for short), now `Sci-Fi` — same
> `sf`, spelled the fun way. The bundled skills keep their `sf-` prefix.

## Requirements

- Node.js `>=22`
- A supported coding agent: **Claude Code**, **OpenCode**, **Codex CLI**, **Cursor**, or **GitHub Copilot**

## Install

```bash
npm install -g @kamilmarzynski/scifi
```

Then, inside the repository you want to manage:

```bash
scifi init
```

`init` prompts you to pick harnesses with an interactive checkbox picker — arrow keys move the cursor (with wrap-around), space toggles a harness, and enter confirms the selection. (Pass `--harness` flags with `--yes` to skip the prompt.)
scaffolds the workspace under `docs/scifi/`, and installs the skill catalog into
your agent. For Claude Code that means `.claude/skills/sf-*/SKILL.md` for all 13
skills. It creates:

```text
docs/scifi/
├── .scifi/config.json     # which harness(es) you chose
├── specs/                 # one folder per feature
└── CONTEXT.md             # project glossary (ubiquitous language)
```

**Supported harnesses:** `claude-code`, `opencode`, `codex`, `cursor`, `github-copilot`.

Use `--harness` to select one or more harnesses non-interactively. The flag is
repeatable — pass it multiple times to install for several agents at once:

```bash
scifi init --harness claude-code --harness cursor
```

`--yes` skips the interactive prompt — you must also pass `--harness <id>`.

Skill files are owned by `scifi` — rerunning `init` overwrites them in place. To
customize one, copy it under a different id (e.g. `my-code-review`) and edit that;
your copy is never touched.

## The lifecycle

Every feature climbs the same one-way ladder. Each step is gated: the CLI checks
that the backing artifact exists before it lets the status advance.

```text
created ──spec.md──► spec-ready ──design.md+tasks──► plan-ready ──► in-progress ──► done
```

| Status        | Means                          | Gate to reach it                     |
| ------------- | ------------------------------ | ------------------------------------ |
| `created`     | container exists, no spec yet  | `scifi spec <slug>`                  |
| `spec-ready`  | spec written and reviewed      | `spec.md` exists                     |
| `plan-ready`  | design + tasks written         | `design.md` and ≥1 task file exist   |
| `in-progress` | implementation started         | reachable only from `plan-ready`     |
| `done`        | built, verified, closed out    | all tasks done **and** no open fixes |

The skills climb the ladder one gate at a time — the CLI enforces the artifact
behind each gate, the skills enforce the order. A scope change that invalidates
the spec rolls the feature back to `spec-ready` and it climbs again through
every gate.

## How to use it (the everyday flow)

Work is driven by invoking skills in your agent. The CLI calls happen *inside*
the skills — you rarely type `scifi` commands by hand except to inspect state.

**The spine is three skills, run in order:**

| Step | Run…           | What happens                                                                 | Ends at      |
| ---- | -------------- | --------------------------------------------------------------------------- | ------------ |
| 1️⃣ Start  | `sf-feature`   | Grills you about the idea one question at a time — real problem, scope, testable acceptance, edge cases — then writes `spec.md` and runs a spec review. | `spec-ready` |
| 2️⃣ Plan   | `sf-plan`      | Grills the *how* against your codebase, writes `design.md`, decomposes it into test-first task files ordered by a `depends-on` graph, runs a plan review. | `plan-ready` |
| 3️⃣ Build  | `sf-implement` | Autonomous: one fresh subagent per task, each test-first (`sf-tdd`) and gated by an independent code review. A handover subagent then verifies the whole feature against spec + design. | `done`       |

To start a brand-new feature, run **`sf-feature`** in your agent — that's the
only command you need to remember. Each skill advances the lifecycle to the next
status and hands you off to the one after it.

The other skills handle the situations that come up around the spine:

| When…                                       | Run…           | What it does                                                          |
| -------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| You picked up work and forgot where it was   | `sf-continue`  | Reads the status and routes you to the right next step               |
| The feature's scope changed                  | `sf-change`    | Rolls the feature back exactly as far as the change cuts, then re-enters |
| You hit a defect with no owning feature      | `sf-bug`       | Investigate-then-fix, no tracked artifact                            |
| You hit a defect in a real feature           | `sf-fix`       | Anchors the fix to that feature — diagnoses against its `spec.md`, `design.md`, and ADRs so the session has the original intent — and records a tracked fix. Works whether the feature is already `done` or still in flight; while in flight the open fix blocks `finish` until resolved. |

**Inspect state any time** with the CLI directly:

```bash
scifi list                 # all features, status, open-fix counts
scifi status <slug>        # full inventory: artifacts, tasks, fixes
scifi task list <slug>     # the task graph and each task's status
```

## What makes it work

A few ideas recur through every stage and are worth understanding:

- **Grill before write.** Spec and plan sessions are interactive interrogations,
  not form-filling. The artifact is written only once every question is answered
  — no `TBD`, no `TODO`.
- **Review gates, not trust.** Every artifact (spec, plan, each task) is reviewed
  by a separate subagent with clean context before the lifecycle advances. The
  reviewer judges; the author acts on the findings under `sf-receiving-review`
  (verify, push back when wrong, no performative agreement). The loop repeats
  until the verdict is **Pass**.
- **Test-first implementation.** No production code without a failing test first
  (`sf-tdd`). The test proves the behavior exists; the regression test proves a
  fixed bug stays fixed.
- **Clean subagent context.** The orchestrator never lets a subagent read its
  session history. Each subagent's context is built from the artifacts alone, so
  reviews stay unbiased and the coordinator stays focused.
- **Deep modules.** Planning and review both push for narrow interfaces over deep
  implementations, and apply the *deletion test*: would removing a unit
  concentrate complexity (keep it) or just scatter it (inline it)?
- **Isolated per feature.** Starting a feature with `sf-feature` creates its own
  git branch (`feat/<slug>`) and worktree (`.worktrees/feat-<slug>`) up front, so
  several features can be built in parallel without colliding, and nothing lands
  on the default branch until the feature's PR merges. `scifi status` reports the
  branch and worktree; the maintainer removes the worktree after the PR merges.

## Project conventions

These live under `docs/scifi/` and the skills read and maintain them:

- **`CONTEXT.md`** — the project glossary (ubiquitous language). Every domain
  term used in a spec is defined here; the skills add terms as they appear, so
  naming stays consistent across features.
- **`adr/NNNN-slug.md`** — Architecture Decision Records. The directory is lazy
  (created on the first record). A decision is recorded only when it is
  hard to reverse, non-obvious, and a real trade-off was made. Skills grep these
  before contradicting a past decision.
- **`HANDOVER.md`** *(optional)* — finishing actions the implement stage runs
  after handover verification passes and before the feature is finished: smoke
  tests, opening a pull request, invoking your release skill. Create it yourself
  when you want it; absent, the feature finishes with no extra actions.
- **`specs/<slug>/`** — one feature: `spec.md`, `design.md`, `tasks/*.md`,
  `fixes/*.md`, and the CLI-managed `.scifi.json` metadata.

## The skills

`init` installs all 13. The first seven are the ones you invoke directly; the
rest are loaded by other skills — the reviewers and `sf-handover` as subagents,
`sf-tdd` and `sf-receiving-review` as disciplines held in the working agent's
own context.

| Skill                | Role                                                            |
| -------------------- | -------------------------------------------------------------- |
| `sf-feature`         | Grill a new idea and write the spec                            |
| `sf-plan`            | Grill the design and decompose into tasks                      |
| `sf-implement`       | Orchestrate test-first implementation, task by task            |
| `sf-continue`        | Route a picked-up feature to its next step                     |
| `sf-change`          | Absorb a scope change; roll the lifecycle back as far as needed |
| `sf-bug`             | Investigate and fix a defect (untracked)                       |
| `sf-fix`             | Fix a defect in a feature, diagnosed against its spec + design (tracked) |
| `sf-tdd`             | Test-first discipline held by implementer subagents            |
| `sf-spec-review`     | Critique a spec before `spec-ready`                            |
| `sf-plan-review`     | Critique a plan before `plan-ready`                            |
| `sf-code-review`     | Critique one task's code before it is marked done              |
| `sf-receiving-review`| How an author acts on a review                                 |
| `sf-handover`        | Verify a completed feature against its spec and design         |

## CLI reference

| Command                                    | Effect                                              |
| ------------------------------------------ | --------------------------------------------------- |
| `scifi init`                               | Scaffold the workspace and install skills           |
| `scifi spec <slug> [--title "..."]`        | Create a feature container (status `created`)       |
| `scifi spec-ready <slug>`                  | `created → spec-ready` (needs `spec.md`)            |
| `scifi plan <slug>`                        | Report planning progress (read-only)                |
| `scifi plan-ready <slug>`                  | `spec-ready → plan-ready` (needs design + tasks)    |
| `scifi start <slug>`                       | `plan-ready → in-progress`                          |
| `scifi task list\|start\|done <slug> ...`  | Manage task status within a feature                 |
| `scifi fix create\|resolve\|wont-fix ...`  | Manage tracked fixes (open fixes block `finish`)    |
| `scifi finish <slug>`                      | `in-progress → done` (all tasks done, no open fixes)|
| `scifi list [--status <s>]`                | List features                                       |
| `scifi status <slug>`                      | Show a feature's full state                         |
| `scifi worktree set <slug> --branch <b> --path <p>` | Record the branch + worktree backing a feature |

Every command accepts `--json` for structured output, and reports failures with
a stable error code (`NOT_FOUND`, `PRECONDITION_FAILED`, `CONFLICT`,
`INVALID_ARGUMENT`).

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run coverage
npm run check        # Biome lint + format
```

User-facing CLI changes are verified against an installed build, not only
source-level tests. That workflow lives under `.testing/` and is covered by
`tests/e2e/`; see `TESTING.md` for the mandatory process.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev
setup, branch/commit conventions, and verification steps. By participating you
agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). To report a security issue,
follow [SECURITY.md](./SECURITY.md) — do not open a public issue.

Releases are automated with [release-please](https://github.com/googleapis/release-please):
merged [Conventional Commits](https://www.conventionalcommits.org/) drive the
version bump and changelog, and merging the Release PR publishes to npm.

## License

MIT — see [LICENSE](./LICENSE).
