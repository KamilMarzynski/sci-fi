# Handover Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `sf-verification` stub and scaffolded `EVALUATION.md` with an `sf-handover` skill (final subagent that verifies spec + design compliance and runs a quality check) and an optional user-authored `HANDOVER.md` whose finishing actions the orchestrator runs before `scifi finish`.

**Architecture:** Skills are authored as `skills/<id>/{body.md, manifest.ts}` pairs; `manifest.ts` files compile to `dist/skills/<id>/manifest.js` (consumed by the catalog loader and `scifi init`). The change is: rename one skill folder + write its real body, edit `sf-implement`'s orchestration body, drop `EVALUATION.md` from the init scaffold, and update tests/docs. No new runtime code paths — the CLI surface is unchanged.

**Tech Stack:** TypeScript (strict, ESM), Vitest, Biome, `tsc` build. Skills are Markdown + TS manifests.

---

## Source of truth (spec)

`docs/superpowers/specs/2026-06-10-handover-flow-design.md`

## File map

- Rename: `skills/sf-verification/` → `skills/sf-handover/` (`body.md`, `manifest.ts`).
- Modify: `skills/sf-implement/body.md` (step 4–5, hard rules).
- Delete: `skills/sf-implement/DISPATCH-FINAL-REVIEW.md`.
- Create: `skills/sf-implement/DISPATCH-HANDOVER.md`.
- Modify: `skills/sf-code-review/body.md` (`sf-verification` → `sf-handover`).
- Modify: `src/core/init/scaffold.ts` (drop EVALUATION bootstrap doc).
- Modify: `src/cli/commands/init.ts` (`BOOTSTRAP_FILES`).
- Modify tests: `tests/core/skills/bundled-catalog.test.ts`, `tests/core/init/install-skills.test.ts`, `tests/core/init/scaffold.test.ts`, `tests/cli/init.test.ts`, `tests/e2e/installed-init.test.ts`.
- Modify docs: `README.md`, `ROADMAP.md`.

Work serially in the order below. Build (`npm run build`) is required before any test that reads `dist/skills` or the installed package (catalog, install-skills, e2e). Each task ends green and committed.

---

### Task 1: Rename `sf-verification` skill folder to `sf-handover`

**Files:**
- Rename: `skills/sf-verification/manifest.ts` → `skills/sf-handover/manifest.ts`
- Rename: `skills/sf-verification/body.md` → `skills/sf-handover/body.md`
- Test: `tests/core/skills/bundled-catalog.test.ts:18-32`

- [ ] **Step 1: Update the catalog test (failing test first)**

In `tests/core/skills/bundled-catalog.test.ts`, replace `'sf-verification'` with `'sf-handover'` in the expected id array. The array must stay alphabetically sorted — `sf-handover` sorts before `sf-implement`, so move it:

```typescript
    expect(ids).toEqual([
      'sf-bug',
      'sf-change',
      'sf-code-review',
      'sf-continue',
      'sf-feature',
      'sf-fix',
      'sf-handover',
      'sf-implement',
      'sf-plan',
      'sf-plan-review',
      'sf-receiving-review',
      'sf-spec-review',
      'sf-tdd',
    ]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && npx vitest run tests/core/skills/bundled-catalog.test.ts`
Expected: FAIL — the loaded ids still include `sf-verification` (folder not yet renamed), so the array does not match.

- [ ] **Step 3: Rename the folder with git**

```bash
git mv skills/sf-verification skills/sf-handover
```

- [ ] **Step 4: Set the new manifest id**

Replace the entire contents of `skills/sf-handover/manifest.ts` with:

```typescript
import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-handover",
  description:
    "Final implementation subagent. Verifies the completed feature against spec + design and runs a quality check before handover. Aware of the optional HANDOVER.md finishing actions the orchestrator runs.",
};
```

- [ ] **Step 5: Remove the stale compiled manifest and rebuild**

`tsc` does not delete outputs for removed source folders. Remove the stale dist folder, then rebuild:

```bash
rm -rf dist/skills/sf-verification
npm run build
```

- [ ] **Step 6: Run the catalog test to verify it passes**

Run: `npx vitest run tests/core/skills/bundled-catalog.test.ts`
Expected: PASS — 13 skills load, ids include `sf-handover`, none named `sf-verification`.

- [ ] **Step 7: Commit**

```bash
git add skills/sf-handover tests/core/skills/bundled-catalog.test.ts
git rm -r --cached skills/sf-verification 2>/dev/null || true
git commit -m "refactor(skills): rename sf-verification to sf-handover"
```

---

### Task 2: Write the real `sf-handover` body

**Files:**
- Modify: `skills/sf-handover/body.md`

The body is the verification subagent's instructions. It is loaded by a fresh subagent dispatched as the final step of `sf-implement`. There is no automated test for body prose; the catalog test (Task 1) already guards that the body file exists and loads.

- [ ] **Step 1: Replace the stub body**

Replace the entire contents of `skills/sf-handover/body.md` with:

````markdown
# sf-handover

You are the final subagent of one feature's implementation. Every task is built
and its per-task code review passed. Your job is to verify the *completed*
feature against its contract and apply a final quality pass, then report back.
You do not fix anything — you read, you judge, you report. The orchestrator
(`sf-implement`) routes your findings to a fix subagent and re-dispatches you
until your verdict is **Pass**.

Your context is clean: build everything you need from the inputs below, not from
any session history.

## Inputs

The orchestrator gives you:

- `{FEATURE_PATH}` — the feature directory (e.g. `docs/scifi/specs/<slug>`).
- `{COMMIT_RANGE}` — the full range of the feature's work (e.g. `<base>..HEAD`).

Read as your contract:

- `{FEATURE_PATH}/spec.md` — what the feature must satisfy.
- `{FEATURE_PATH}/design.md` — the technical design: modules, seams, strategy.
- `docs/scifi/CONTEXT.md` — the ubiquitous-language glossary.
- The diff for `{COMMIT_RANGE}` — the whole change, across all tasks.

Optionally, if it exists:

- `docs/scifi/HANDOVER.md` — user-defined finishing actions (smoke tests, PR
  creation, pointers to process skills). You do **not** run these — the
  orchestrator does. Read it only so you can list what remains (see Output).

If `{FEATURE_PATH}/spec.md` or `design.md` is missing, stop and say so — you
cannot verify without the contract.

## Checks (always run)

1. **Spec compliance.** Walk every requirement in `spec.md`. For each, point to
   where the implementation satisfies it. Flag any requirement that is missing,
   partial, or contradicted.

2. **Design compliance.** Confirm the change is built along the modules and
   seams `design.md` describes. Flag drift: responsibilities placed in the wrong
   unit, seams that leak, a structure that diverges from the agreed design
   without justification.

3. **Final quality check.** Look across the whole change for what no single task
   owns: cross-task coherence, integration seams, placeholders presented as
   finished work, silent failures, and whether the project's required checks are
   green. Run the suite and build if that is how this repo confirms green.

## HANDOVER.md awareness

If `docs/scifi/HANDOVER.md` exists, list the finishing actions it defines so the
orchestrator can run them after you pass. Do not execute them yourself — some
are irreversible or externally visible (PR creation, pushes) and stay at the
orchestrator's top level.

## Output

Report back exactly:

- **Verdict:** `Pass` or `Fail`.
- **Findings:** a list, each tied to the check it came from (spec / design /
  quality). Empty on `Pass`.
- **Handover actions:** the actions from `HANDOVER.md` the orchestrator should
  run, in order — or "none" if the file is absent or empty.
````

- [ ] **Step 2: Rebuild so the body ships with the bundle**

Run: `npm run build`
Expected: build succeeds (no manifest change, body is copied at install time).

- [ ] **Step 3: Verify the catalog still loads 13 skills**

Run: `npx vitest run tests/core/skills/bundled-catalog.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills/sf-handover/body.md
git commit -m "feat(sf-handover): write spec/design/quality verification body"
```

---

### Task 3: Point the install-skills test at `sf-handover`

**Files:**
- Modify: `tests/core/init/install-skills.test.ts:33-45`

This test checks a subset of installed skill ids. It currently lists
`sf-verification`. Update it to `sf-handover`.

- [ ] **Step 1: Update the id list (failing test first)**

In `tests/core/init/install-skills.test.ts`, in the `for (const id of [...])`
loop, replace `'sf-verification'` with `'sf-handover'`:

```typescript
    for (const id of [
      'sf-feature',
      'sf-plan',
      'sf-fix',
      'sf-bug',
      'sf-change',
      'sf-implement',
      'sf-spec-review',
      'sf-plan-review',
      'sf-code-review',
      'sf-handover',
      'sf-tdd',
    ]) {
```

- [ ] **Step 2: Run the test to verify it passes after build**

Run: `npm run build && npx vitest run tests/core/init/install-skills.test.ts`
Expected: PASS — `sf-handover/SKILL.md` is installed; no skill named `sf-verification` remains.

- [ ] **Step 3: Commit**

```bash
git add tests/core/init/install-skills.test.ts
git commit -m "test(init): expect sf-handover in installed skill set"
```

---

### Task 4: Update the `sf-code-review` cross-reference

**Files:**
- Modify: `skills/sf-code-review/body.md:7-9`

- [ ] **Step 1: Update the reference**

In `skills/sf-code-review/body.md`, change the sentence that reads:

```
You review by reading only. You do not run the suite or the build — a separate
`sf-verification` subagent owns that. Trust the diff and the files in front of
you.
```

to:

```
You review by reading only. You do not run the suite or the build — the final
`sf-handover` subagent owns that. Trust the diff and the files in front of
you.
```

- [ ] **Step 2: Rebuild**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add skills/sf-code-review/body.md
git commit -m "docs(sf-code-review): reference sf-handover instead of sf-verification"
```

---

### Task 5: Rewrite `sf-implement` final stage and dispatch template

**Files:**
- Modify: `skills/sf-implement/body.md` (the "### 4. Final review and verification" section, the "### 5. Finish" section, and the "## Hard rules" list)
- Delete: `skills/sf-implement/DISPATCH-FINAL-REVIEW.md`
- Create: `skills/sf-implement/DISPATCH-HANDOVER.md`

- [ ] **Step 1: Replace section 4**

In `skills/sf-implement/body.md`, replace the entire section that currently
reads:

```markdown
### 4. Final review and verification

After every task is `done`:

- Dispatch a whole-feature code review (`DISPATCH-FINAL-REVIEW.md`) over the
  complete change, not just the last task — integration seams and cross-task
  consistency only show up here.
- Run `sf-verification` to exercise the feature the way `EVALUATION.md`
  prescribes (start the app, drive it, e.g. Playwright).
- Route every finding back to a subagent to fix; the orchestrator coordinates
  but does not fix substantial issues itself. Only trivially small fixes are
  yours. Re-review until clean.
```

with:

```markdown
### 4. Handover

After every task is `done`:

- Dispatch the handover subagent with `DISPATCH-HANDOVER.md`, which loads the
  `sf-handover` skill. It verifies the whole feature against `spec.md` and
  `design.md` and runs a final quality check over the complete change — there is
  no separate whole-feature code review; the per-task reviews already gated each
  task to **Pass**.
- Route every finding back to a fix subagent; the orchestrator coordinates but
  does not fix substantial issues itself. Only trivially small fixes are yours.
  Re-dispatch handover until the verdict is **Pass**.
- When handover passes, read `docs/scifi/HANDOVER.md` if it exists and run the
  finishing actions it defines, in order — smoke tests, PR creation, invoking
  any skills it points to. These run here at the orchestrator's top level (not
  inside a subagent) so irreversible or visible actions stay visible. If the
  file is absent, there are no finishing actions and you go straight to finish.
```

- [ ] **Step 2: Update section 5**

Replace the "### 5. Finish" section, currently:

```markdown
### 5. Finish

```
scifi finish <slug> --json
```

Transitions `in-progress → done`. This is the end of the implement stage.
```

with:

```markdown
### 5. Finish

```
scifi finish <slug> --json
```

Transitions `in-progress → done`. Run this **last** — after handover passes and
after every `HANDOVER.md` action (PR creation included) has completed. This is
the end of the implement stage.
```

- [ ] **Step 3: Update the hard rules**

In the "## Hard rules" list, replace the bullet:

```markdown
- Never call `scifi finish` while a final-review or verification finding is
  open.
```

with:

```markdown
- Never call `scifi finish` while a handover finding is open or a `HANDOVER.md`
  action is still pending.
```

- [ ] **Step 4: Delete the old dispatch template**

```bash
git rm skills/sf-implement/DISPATCH-FINAL-REVIEW.md
```

- [ ] **Step 5: Create the handover dispatch template**

Create `skills/sf-implement/DISPATCH-HANDOVER.md` with:

````markdown
# Dispatch template: handover

Dispatch the final subagent once every task is `done`, before `scifi finish`.
Replace `{FEATURE_PATH}` with the feature directory and `{COMMIT_RANGE}` with the
full range of the feature's work (e.g. `<branch-base>..HEAD`). The checks and
output format live in the `sf-handover` skill — do not restate them here.

```
You are running handover for a complete feature implementation. Load and follow the `sf-handover` skill.

Feature: {FEATURE_PATH}
Changes to verify: {COMMIT_RANGE}

Verify the whole feature against {FEATURE_PATH}/spec.md and
{FEATURE_PATH}/design.md, plus docs/scifi/CONTEXT.md, and run the final quality
check the skill defines. If docs/scifi/HANDOVER.md exists, list its finishing
actions for the orchestrator to run — do not execute them. Return your verdict,
findings, and handover actions exactly as the sf-handover skill defines.
```
````

- [ ] **Step 6: Rebuild and confirm the catalog is intact**

Run: `npm run build && npx vitest run tests/core/skills/bundled-catalog.test.ts`
Expected: PASS — `sf-implement` body and assets still load; 13 skills.

- [ ] **Step 7: Commit**

```bash
git add skills/sf-implement
git commit -m "feat(sf-implement): replace final review + verification with handover stage"
```

---

### Task 6: Stop scaffolding `EVALUATION.md`

**Files:**
- Modify: `src/core/init/scaffold.ts:43-54` and `src/core/init/scaffold.ts:133-150`
- Modify: `tests/core/init/scaffold.test.ts`

- [ ] **Step 1: Update the core scaffold test (failing test first)**

In `tests/core/init/scaffold.test.ts`:

  a. In the "creates the base scifi directories and bootstrap docs" test, delete the EVALUATION.md assertion (lines 31-33) and add an assertion that EVALUATION.md is NOT written. Replace:

```typescript
    expect(readFileSync(join(projectRoot, 'docs', 'scifi', 'EVALUATION.md'), 'utf8')).toBe(
      expectedEvaluationDocument,
    );
```

  with:

```typescript
    await expect(
      access(join(projectRoot, 'docs', 'scifi', 'EVALUATION.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
```

  b. In the "preserves existing docs when rerun" test, remove the EVALUATION.md write and assertion. Delete these blocks:

```typescript
    writeFileSync(
      join(projectRoot, 'docs', 'scifi', 'EVALUATION.md'),
      '# Existing evaluation\nDo not replace.\n',
      'utf8',
    );
```

  and

```typescript
    expect(readFileSync(join(projectRoot, 'docs', 'scifi', 'EVALUATION.md'), 'utf8')).toBe(
      '# Existing evaluation\nDo not replace.\n',
    );
```

  c. In the "fails when a doc path already exists as a directory" test, repoint the conflict from EVALUATION.md to CONTEXT.md. Replace `EVALUATION.md` with `CONTEXT.md` in both the `mkdir` call (line 78) and the expected message (line 83).

  d. In the "does not create bootstrap directories when a doc path conflicts" test (which already uses CONTEXT.md), no change is needed.

  e. In the "fails without partial writes when a scaffold directory path conflicts" test, change the final assertion (lines 117-119) from `EVALUATION.md` to `CONTEXT.md`:

```typescript
    await expect(access(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
```

  f. Delete the `expectedEvaluationDocument` constant (lines 123-138).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/core/init/scaffold.test.ts`
Expected: FAIL — `scaffoldInit` still writes `EVALUATION.md`, so the new "does not exist" assertion fails (and the directory-conflict test still expects the EVALUATION.md message).

- [ ] **Step 3: Remove EVALUATION from the scaffold source**

In `src/core/init/scaffold.ts`, change `buildBootstrapDocuments` (lines 43-54) to:

```typescript
function buildBootstrapDocuments(specsRoot: string): BootstrapDocument[] {
  return [
    {
      path: join(specsRoot, 'CONTEXT.md'),
      contents: buildContextDocument(),
    },
  ];
}
```

Then delete the `buildEvaluationDocument` function entirely (lines 133-150).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/core/init/scaffold.test.ts`
Expected: PASS — only `CONTEXT.md` is scaffolded; `EVALUATION.md` is absent.

- [ ] **Step 5: Typecheck (no dead references)**

Run: `npm run typecheck`
Expected: PASS — `buildEvaluationDocument` is fully removed and unreferenced.

- [ ] **Step 6: Commit**

```bash
git add src/core/init/scaffold.ts tests/core/init/scaffold.test.ts
git commit -m "feat(init): stop scaffolding EVALUATION.md"
```

---

### Task 7: Drop `EVALUATION.md` from the init command's reported files

**Files:**
- Modify: `src/cli/commands/init.ts:30`
- Modify: `tests/cli/init.test.ts`

- [ ] **Step 1: Update the CLI init test (failing test first)**

In `tests/cli/init.test.ts`:

  a. In "creates the baseline project structure...", replace the EVALUATION.md read assertion (lines 34-36) with a CONTEXT.md read assertion:

```typescript
    expect(readFileSync(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), 'utf8')).toContain(
      '# CONTEXT.md',
    );
    await expect(
      access(join(projectRoot, 'docs', 'scifi', 'EVALUATION.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
```

  b. In "fails without partial writes when a bootstrap doc path conflicts", repoint the conflict from EVALUATION.md to CONTEXT.md — replace `EVALUATION.md` with `CONTEXT.md` in the `mkdir` call (line 47) and the expected stderr fragment (line 54).

  c. In "fails without partial writes when a scaffold directory path conflicts", change the EVALUATION.md absence assertion (lines 89-91) to CONTEXT.md.

  d. Delete the `expectedEvaluationDocument` constant (lines 98-113).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: FAIL — `BOOTSTRAP_FILES` still includes `EVALUATION.md`, so init writes it and the bootstrap-conflict test still targets the wrong file.

- [ ] **Step 3: Update `BOOTSTRAP_FILES`**

In `src/cli/commands/init.ts`, line 30, change:

```typescript
const BOOTSTRAP_FILES = ['EVALUATION.md', 'CONTEXT.md'];
```

to:

```typescript
const BOOTSTRAP_FILES = ['CONTEXT.md'];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/cli/init.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/init.ts tests/cli/init.test.ts
git commit -m "feat(init): drop EVALUATION.md from reported bootstrap files"
```

---

### Task 8: Update the installed-build e2e test

**Files:**
- Modify: `tests/e2e/installed-init.test.ts`

- [ ] **Step 1: Remove EVALUATION.md from the e2e expectations (failing test first)**

In `tests/e2e/installed-init.test.ts`:

  a. In the first test (lines 22-24), replace the EVALUATION.md read with an absence check:

```typescript
      expect(
        existsSync(join(installation.installDirectory, 'docs', 'scifi', 'EVALUATION.md')),
      ).toBe(false);
      expect(
        existsSync(join(installation.installDirectory, 'docs', 'scifi', 'CONTEXT.md')),
      ).toBe(true);
```

  b. In the rerun test, replace the EVALUATION.md preservation case with CONTEXT.md. Change `evaluationPath` (line 66) to:

```typescript
      const contextPath = join(scifiRoot, 'CONTEXT.md');
```

  Replace the write (line 85):

```typescript
      writeFileSync(contextPath, preservedContextDocument, 'utf8');
```

  Replace the assertion (line 103):

```typescript
      expect(readFileSync(contextPath, 'utf8')).toBe(preservedContextDocument);
```

  c. In the conflict test (lines 149-151), the EVALUATION.md absence check stays correct conceptually but rename it to assert no stray docs; leave the `false` assertion but point it at CONTEXT.md is unnecessary — instead delete lines 149-151 (the EVALUATION.md absence assertion) since the directory conflict already prevents any doc write and `.claude` absence is asserted.

  d. In the harness-not-implemented test (lines 171-173), delete the EVALUATION.md absence assertion — the `.claude` absence assertion on line 170 already proves nothing was written.

  e. Delete the `expectedEvaluationDocument` constant (lines 180-195) and the `preservedEvaluationDocument` constant (lines 197-200). Add a `preservedContextDocument` constant:

```typescript
const preservedContextDocument = `# CONTEXT.md

Preserve this custom glossary note on rerun.
`;
```

- [ ] **Step 2: Build then run the e2e test to verify it passes**

Run: `npm run build && npx vitest run tests/e2e/installed-init.test.ts`
Expected: PASS — installed init writes `CONTEXT.md` only; `EVALUATION.md` never appears; rerun preserves a user-edited `CONTEXT.md`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/installed-init.test.ts
git commit -m "test(e2e): drop EVALUATION.md from installed init expectations"
```

---

### Task 9: Update README and ROADMAP

**Files:**
- Modify: `README.md:62`
- Modify: `README.md` (add a HANDOVER.md section)
- Modify: `ROADMAP.md:42`

- [ ] **Step 1: Update the bundled-skills list**

In `README.md`, line 62, replace `sf-verification` with `sf-handover` in the skills list:

```
... `sf-code-review`, `sf-handover`, `sf-tdd`).
```

- [ ] **Step 2: Add a HANDOVER.md section**

In `README.md`, immediately after the "## Bundled Skills" section (before "## Installed-Build Verification"), add:

```markdown
## Handover (optional HANDOVER.md)

When `sf-implement` finishes a feature, it dispatches the `sf-handover` subagent
to verify the completed work against the feature's `spec.md` and `design.md` and
run a final quality check. This always runs; nothing configures it.

You can optionally add `docs/scifi/HANDOVER.md` to define finishing actions the
orchestrator runs after handover verification passes and before `scifi finish` —
for example smoke tests, opening a pull request, or invoking a skill that
describes your release process. The file is not scaffolded by `scifi init`;
create it yourself when you want it. List the actions in the order they should
run; point to any skills by name. If the file is absent, the feature finishes
with no extra actions.
```

- [ ] **Step 3: Update ROADMAP**

In `ROADMAP.md`, line 42, change:

```
- Scaffold docs: `TESTING.md` replaced by `EVALUATION.md`; `CONTEXT.md` added. Architecture decisions are captured lazily in `docs/scifi/adr/` — there is no generated `ARCHITECTURE.md`.
```

to:

```
- Scaffold docs: `CONTEXT.md` is the only generated bootstrap doc. `EVALUATION.md` was dropped in favor of an optional, user-authored `docs/scifi/HANDOVER.md` (see README). Architecture decisions are captured lazily in `docs/scifi/adr/` — there is no generated `ARCHITECTURE.md`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md ROADMAP.md
git commit -m "docs: document sf-handover and optional HANDOVER.md"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean rebuild**

```bash
rm -rf dist && npm run build
```

Expected: build succeeds; `dist/skills/sf-handover/manifest.js` exists and `dist/skills/sf-verification/` does not.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: PASS — all unit, CLI, and e2e tests green.

- [ ] **Step 4: Biome clean**

Run: `npm run check:fix && npm run check`
Expected: `check` is green (no errors). Stage and commit any formatting changes Biome applied:

```bash
git add -A
git commit -m "chore: biome formatting after handover flow" || true
```

- [ ] **Step 5: Confirm no stray `sf-verification` / `EVALUATION` references remain**

Run:

```bash
grep -rn "sf-verification\|EVALUATION" src skills tests README.md ROADMAP.md
```

Expected: no matches. (The design/plan docs under `docs/superpowers/` may still reference them historically — that is fine.)

---

## Self-review

**Spec coverage:**
- Flow change (drop final review, handover subagent, orchestrator runs HANDOVER.md, finish last) → Task 5.
- `sf-handover` skill rename + manifest + real body → Tasks 1, 2.
- Dispatch template swap → Task 5.
- `sf-implement` body + hard rules → Task 5.
- Optional `HANDOVER.md`, not scaffolded, README documented → Tasks 6, 7, 9.
- EVALUATION.md removal (scaffold.ts + init.ts) → Tasks 6, 7.
- Tests affected (scaffold, cli init, e2e init, catalog, install-skills) → Tasks 1, 3, 6, 7, 8.
- `sf-code-review` cross-reference → Task 4.
- ROADMAP note → Task 9.
All spec sections map to a task.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Every code/markdown step shows the exact content.

**Type consistency:** No new types or signatures introduced. `BOOTSTRAP_FILES`, `buildBootstrapDocuments`, and `buildContextDocument` keep their existing signatures; only `buildEvaluationDocument` is removed (and all references with it). Skill id `sf-handover` is used identically across the catalog test, install-skills test, dispatch template, and cross-references.
