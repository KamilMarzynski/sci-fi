# Handover flow — design

Date: 2026-06-10
Status: approved (pending spec review)

## Problem

The final stage of `sf-implement` currently does two things after all tasks are
`done`: a whole-feature code review (`DISPATCH-FINAL-REVIEW.md`) and a
`sf-verification` step that "exercises the feature the way `EVALUATION.md`
prescribes". `sf-verification` is a stub (`TODO: prompt content`), and
`EVALUATION.md` is a scaffolded doc that overlaps with the per-task review and
TDD discipline already in place.

We are replacing "verification" with a **handover** concept:

- Per-task code reviews already guard code quality at the task level.
- The final step should verify the *completed* feature against its contract
  (spec + design) and apply a quality pass, then run any user-defined finishing
  actions before the feature is closed.
- Users control the finishing actions through an **optional** `HANDOVER.md`,
  not a scaffolded template.

## Goals

- Replace the `sf-verification` stub with a real `sf-handover` skill.
- Make handover the single final subagent of implementation: verify spec +
  design compliance and run a final quality check, then report back.
- Let an optional `docs/scifi/HANDOVER.md` define finishing actions (smoke
  tests, PR creation, pointers to process skills) that the orchestrator runs
  after verification passes.
- Stop scaffolding `EVALUATION.md`; document `HANDOVER.md` in the README
  instead.

## Non-goals

- No whole-feature final code review. Per-task reviews are sufficient; the
  separate final review is removed.
- No scaffolded `HANDOVER.md` template. The file is opt-in.
- No change to the per-task implement → review → done loop.

## Flow

Within `sf-implement`, the per-task loop is unchanged. The final stage changes:

**Before:** all tasks `done` → whole-feature final code review → `sf-verification`
→ `scifi finish`.

**After:** all tasks `done` →
1. **Dispatch the `sf-handover` subagent** (verification: spec + design + final
   quality check).
2. Route every finding back to a fix subagent; re-run handover until the verdict
   is `Pass`. The orchestrator coordinates but does not fix substantial issues
   itself.
3. **Orchestrator reads optional `docs/scifi/HANDOVER.md`** and executes its
   finishing actions in order — including PR creation, which runs here as a
   HANDOVER action **before** finish.
4. `scifi finish <slug> --json`.

Ordering rule: `scifi finish` runs last, after handover verification passes and
after all HANDOVER.md actions (PR creation included) complete.

## Components

### `sf-handover` skill (rename of `sf-verification`)

- Folder `skills/sf-verification/` → `skills/sf-handover/`.
- `manifest.ts`: `id: "sf-handover"`, description: *"Final implementation
  subagent. Verifies the completed feature against spec + design and runs a
  quality check before handover. Aware of the optional HANDOVER.md finishing
  actions the orchestrator runs."*
- `body.md` (real content, replaces the stub). Structure:
  - **Role** — the final subagent of one feature's implementation. Clean
    context. Verify, do not fix: report findings back to the orchestrator.
  - **Inputs** — `{FEATURE_PATH}/spec.md`, `{FEATURE_PATH}/design.md`, the full
    feature diff, `docs/scifi/CONTEXT.md`; optional `docs/scifi/HANDOVER.md`.
  - **Checks (always run):**
    1. **Spec compliance** — every requirement in `spec.md` is satisfied by the
       implementation.
    2. **Design compliance** — built per `design.md` modules and seams; flag
       drift from the agreed design.
    3. **Final quality check** — cross-task coherence, no placeholders presented
       as finished, no silent failures, required checks green.
  - **HANDOVER.md awareness** — if `docs/scifi/HANDOVER.md` exists, read it and
    list the finishing actions it defines. The orchestrator runs them, so
    surface them in the report rather than executing them.
  - **Output** — verdict `Pass` / `Fail`, a findings list, and any HANDOVER.md
    actions the orchestrator should run.

### Dispatch template

- Delete `skills/sf-implement/DISPATCH-FINAL-REVIEW.md`.
- Add `skills/sf-implement/DISPATCH-HANDOVER.md` — dispatches the final subagent
  to load and follow `sf-handover`, passing `{FEATURE_PATH}` and the feature
  `{COMMIT_RANGE}`. Criteria and output format live in the `sf-handover` skill;
  the template does not restate them (matches the existing dispatch-template
  style).

### `sf-implement/body.md`

- Replace step 4 ("Final review and verification") with the handover flow above.
- Step 5 ("Finish") notes that PR creation, if defined in HANDOVER.md, has
  already run before `scifi finish`.
- Update the hard rules: remove the "never `scifi finish` while a final-review
  or verification finding is open" wording to reference handover findings.

### `HANDOVER.md` (optional, user-authored)

- Lives at `docs/scifi/HANDOVER.md`. **Not** scaffolded by `scifi init`; no
  template is written.
- When present, defines finishing actions the orchestrator runs after handover
  verification passes: smoke tests, PR creation, pointers to skills that
  describe a finishing process, etc.
- README gains a section: location, that it is optional, that it controls how
  handover finishing runs, and example action types.

### Scaffolding (`scifi init`)

- `src/core/init/scaffold.ts`: remove `buildEvaluationDocument()` and its
  `buildBootstrapDocuments` entry. `CONTEXT.md` remains the only bootstrap doc.
- `src/cli/commands/init.ts`: `BOOTSTRAP_FILES = ['CONTEXT.md']`.

## Tests affected

- `tests/core/init/scaffold.test.ts` — drop EVALUATION.md assertions and the
  `expectedEvaluationDocument` fixture; keep CONTEXT.md and conflict/rerun cases.
- `tests/cli/init.test.ts` — same EVALUATION.md removal.
- `tests/e2e/installed-init.test.ts` — drop EVALUATION.md reads/assertions and
  fixtures.
- `tests/core/skills/bundled-catalog.test.ts` and
  `tests/core/init/install-skills.test.ts` — `sf-verification` → `sf-handover`
  in expected id lists (count stays 13).

## Other references to update

- `skills/sf-code-review/body.md` — "`sf-verification` subagent owns that" →
  `sf-handover`.
- `ROADMAP.md` — record the EVALUATION.md → optional HANDOVER.md shift; add a
  "Known Debt" note only if a follow-up remains.

## Risks

- HANDOVER.md actions are user-authored and may include irreversible/visible
  operations (PR creation, pushes). The orchestrator runs them at top level (not
  buried in a subagent) so they stay visible, and only after verification
  passes.
- Removing the whole-feature final review shifts all code-quality coverage onto
  per-task reviews plus the handover quality check. Acceptable given per-task
  reviews already gate each task to `Pass`.
