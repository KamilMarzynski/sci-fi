# sf-fix Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `sf-fix` skill — a feature-anchored, test-first debug-and-fix flow — and the CLI fix-lifecycle commands (`fix resolve` / `fix wont-fix`) it needs to close a tracked fix.

**Architecture:** A new `src/core/fixes/transition.ts` validates and writes fix status changes; a `findFixById` helper in `list.ts` locates a fix file by id. The flat `scifi fix <desc>` command is restructured into a parent command (`fix create` / `fix resolve` / `fix wont-fix`) mirroring the existing `task` command. The `skills/sf-fix/body.md` prompt orchestrates the human-facing flow.

**Tech Stack:** TypeScript (strict, no `any`, no casts), Node ESM (`.js` import specifiers), commander, vitest, biome. Errors via `ScifiError` (exit codes: `INVALID_ARGUMENT`=2, `NOT_FOUND`=3, `PRECONDITION_FAILED`=4, `CONFLICT`=5).

## File Structure

- **Create** `src/core/fixes/transition.ts` — `updateFixStatus(projectRoot, featureSlug, fixId, targetStatus)`.
- **Create** `tests/core/fixes/transition.test.ts` — unit tests for the transition.
- **Modify** `src/core/fixes/list.ts` — add `findFixById` + `FixFileLocation`.
- **Modify** `tests/core/fixes/list.test.ts` — tests for `findFixById`.
- **Modify** `src/cli/commands/fix.ts` — restructure into `fix create` / `fix resolve` / `fix wont-fix`.
- **Modify** `tests/cli/fix.test.ts` — migrate flat→`create`, add resolve/wont-fix + finish-unblock e2e.
- **Write** `skills/sf-fix/body.md` — the orchestration prompt.
- **Modify** `skills/sf-fix/manifest.ts` — refine description / argumentHint.

Verification commands (run from repo root):
- Targeted test: `npx vitest run <path>`
- Full suite: `npm test`
- Lint/format gate (must be green): `npm run check`
- Installed-build check: per `TESTING.md` `.testing/` flow.

---

### Task 1: `findFixById` helper in fixes/list.ts

**Files:**
- Modify: `src/core/fixes/list.ts`
- Test: `tests/core/fixes/list.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/core/fixes/list.test.ts` (reuse the file's existing scaffold helpers; this snippet assumes a helper that writes a fix file — if none exists, write the fix file inline with `writeFixFile`):

```ts
import { findFixById } from '../../../src/core/fixes/list.js';

describe('findFixById', () => {
  it('returns the file location and frontmatter for a matching id', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-findfix-'));
    temporaryDirectories.push(projectRoot);
    const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFixFile(join(fixesDir, 'FIX-0001-token-expiry.md'), {
      frontmatter: {
        id: 'FIX-0001',
        slug: 'token-expiry',
        status: 'open',
        feature: 'auth-flow',
        created: '2026-06-10T00:00:00Z',
      },
      body: '# token expiry\n',
    });

    const found = await findFixById(projectRoot, 'auth-flow', 'FIX-0001');
    expect(found?.frontmatter.slug).toBe('token-expiry');
    expect(found?.filePath).toContain('FIX-0001-token-expiry.md');
  });

  it('returns undefined when no fix matches the id', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-findfix-'));
    temporaryDirectories.push(projectRoot);
    const found = await findFixById(projectRoot, 'auth-flow', 'FIX-9999');
    expect(found).toBeUndefined();
  });
});
```

Ensure the test file imports `writeFixFile` from `'../../../src/core/fixes/frontmatter.js'` and `mkdir`/`mkdtemp`/`join`/`tmpdir` as the existing tests do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/fixes/list.test.ts`
Expected: FAIL — `findFixById` is not exported.

- [ ] **Step 3: Implement `findFixById`**

Add to `src/core/fixes/list.ts`:

```ts
export interface FixFileLocation {
  filePath: string;
  frontmatter: FixFrontmatter;
}

export async function findFixById(
  projectRoot: string,
  featureSlug: string,
  fixId: string,
): Promise<FixFileLocation | undefined> {
  const fixesDir = buildFixesDirectoryPath(projectRoot, featureSlug);

  const entries = await readdir(fixesDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingPathError(error)) return [];
    throw error;
  });

  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  for (const entry of mdFiles) {
    const filePath = join(fixesDir, entry.name);
    const file = await readFixFile(filePath);
    if (file.frontmatter.id === fixId) {
      return { filePath, frontmatter: file.frontmatter };
    }
  }

  return undefined;
}
```

(`readdir`, `join`, `readFixFile`, `buildFixesDirectoryPath`, `isMissingPathError`, and `FixFrontmatter` are already imported in this file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/fixes/list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/fixes/list.ts tests/core/fixes/list.test.ts
git commit -m "feat(fixes): add findFixById helper"
```

---

### Task 2: `updateFixStatus` core transition

**Files:**
- Create: `src/core/fixes/transition.ts`
- Test: `tests/core/fixes/transition.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/fixes/transition.test.ts`:

```ts
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFixFile, writeFixFile } from '../../../src/core/fixes/frontmatter.js';
import { updateFixStatus } from '../../../src/core/fixes/transition.js';
import type { FixStatus } from '../../../src/core/fixes/types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function createFixFile(projectRoot: string, status: FixStatus): Promise<void> {
  const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes');
  await mkdir(fixesDir, { recursive: true });
  await writeFixFile(join(fixesDir, 'FIX-0001-token-expiry.md'), {
    frontmatter: {
      id: 'FIX-0001',
      slug: 'token-expiry',
      status,
      feature: 'auth-flow',
      created: '2026-06-10T00:00:00Z',
    },
    body: '# token expiry\n',
  });
}

describe('updateFixStatus', () => {
  it('transitions an open fix to resolved and preserves the body', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'open');

    const result = await updateFixStatus(projectRoot, 'auth-flow', 'FIX-0001', 'resolved');

    expect(result.previousStatus).toBe('open');
    expect(result.newStatus).toBe('resolved');
    const file = await readFixFile(
      join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes', 'FIX-0001-token-expiry.md'),
    );
    expect(file.frontmatter.status).toBe('resolved');
    expect(file.body).toContain('# token expiry');
  });

  it('transitions an in-progress fix to wont-fix', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'in-progress');

    const result = await updateFixStatus(projectRoot, 'auth-flow', 'FIX-0001', 'wont-fix');
    expect(result.newStatus).toBe('wont-fix');
  });

  it('throws NOT_FOUND when the fix id does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'open');

    await expect(
      updateFixStatus(projectRoot, 'auth-flow', 'FIX-9999', 'resolved'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws PRECONDITION_FAILED when the fix is already resolved', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'resolved');

    await expect(
      updateFixStatus(projectRoot, 'auth-flow', 'FIX-0001', 'resolved'),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/fixes/transition.test.ts`
Expected: FAIL — `transition.js` does not exist.

- [ ] **Step 3: Implement `updateFixStatus`**

Create `src/core/fixes/transition.ts`:

```ts
import { ScifiError } from '../output/errors.js';
import { readFixFile, writeFixFile } from './frontmatter.js';
import { findFixById } from './list.js';
import type { FixStatus } from './types.js';

export interface UpdateFixStatusResult {
  feature: string;
  id: string;
  slug: string;
  previousStatus: FixStatus;
  newStatus: FixStatus;
}

export async function updateFixStatus(
  projectRoot: string,
  featureSlug: string,
  fixId: string,
  targetStatus: FixStatus,
): Promise<UpdateFixStatusResult> {
  const location = await findFixById(projectRoot, featureSlug, fixId);

  if (location === undefined) {
    throw new ScifiError(
      'NOT_FOUND',
      `Fix "${fixId}" does not exist in feature "${featureSlug}".`,
      { hint: 'Run `scifi status <slug>` to see this feature\'s fixes.' },
    );
  }

  const file = await readFixFile(location.filePath);
  const previousStatus = file.frontmatter.status;

  if (previousStatus !== 'open' && previousStatus !== 'in-progress') {
    throw new ScifiError(
      'PRECONDITION_FAILED',
      `Cannot transition fix ${fixId}: it is already ${previousStatus}.`,
      { hint: 'Only open or in-progress fixes can be resolved or marked wont-fix.' },
    );
  }

  await writeFixFile(location.filePath, {
    ...file,
    frontmatter: { ...file.frontmatter, status: targetStatus },
  });

  return {
    feature: featureSlug,
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    previousStatus,
    newStatus: targetStatus,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/fixes/transition.test.ts`
Expected: PASS (all four).

- [ ] **Step 5: Commit**

```bash
git add src/core/fixes/transition.ts tests/core/fixes/transition.test.ts
git commit -m "feat(fixes): add updateFixStatus transition"
```

---

### Task 3: Restructure `fix` CLI into create/resolve/wont-fix

**Files:**
- Modify: `src/cli/commands/fix.ts`
- Test: `tests/cli/fix.test.ts`

- [ ] **Step 1: Migrate existing tests to `fix create` and add resolve/wont-fix + finish-unblock tests**

In `tests/cli/fix.test.ts`:
- In the existing create tests, change the parsed args from `['node','scifi','fix', <desc>, '--feature', <slug>]` to `['node','scifi','fix','create', <desc>, '--feature', <slug>]`, and the `runCli` call from `['fix', 'some description', '--feature', 'nonexistent']` to `['fix','create','some description','--feature','nonexistent']`. The "fails when --feature omitted" test becomes `['node','scifi','fix','create','some description']`.
- Add these new tests (they use `runCli` from `./helpers.js`, already imported):

```ts
it('resolves an open fix via `fix resolve`', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);
  await scaffoldFeature(projectRoot, 'auth-flow');

  await runCli(['fix', 'create', 'token expiry off by one', '--feature', 'auth-flow']);
  const run = await runCli(['fix', 'resolve', 'auth-flow', 'FIX-0001']);

  expect(run.exitCode).toBe(0);
  const file = await readFixFile(
    join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes', 'FIX-0001-token-expiry-off-by-one.md'),
  );
  expect(file.frontmatter.status).toBe('resolved');
});

it('marks a fix wont-fix via `fix wont-fix`', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);
  await scaffoldFeature(projectRoot, 'auth-flow');

  await runCli(['fix', 'create', 'token expiry off by one', '--feature', 'auth-flow']);
  const run = await runCli(['fix', 'wont-fix', 'auth-flow', 'FIX-0001']);

  expect(run.exitCode).toBe(0);
  const file = await readFixFile(
    join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes', 'FIX-0001-token-expiry-off-by-one.md'),
  );
  expect(file.frontmatter.status).toBe('wont-fix');
});

it('returns NOT_FOUND when resolving a missing fix id', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);
  await scaffoldFeature(projectRoot, 'auth-flow');

  const run = await runCli(['fix', 'resolve', 'auth-flow', 'FIX-9999']);
  expect(run.exitCode).toBe(3);
  expect(run.stderr).toContain('NOT_FOUND');
});

it('resolving the last open fix unblocks `finish`', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);
  await scaffoldFeature(projectRoot, 'auth-flow');

  await runCli(['fix', 'create', 'token expiry off by one', '--feature', 'auth-flow']);
  const blocked = await runCli(['finish', 'auth-flow']);
  expect(blocked.exitCode).toBe(4);

  await runCli(['fix', 'resolve', 'auth-flow', 'FIX-0001']);
  const finished = await runCli(['finish', 'auth-flow']);
  expect(finished.exitCode).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/cli/fix.test.ts`
Expected: FAIL — `fix create` / `fix resolve` / `fix wont-fix` subcommands do not exist.

- [ ] **Step 3: Rewrite `src/cli/commands/fix.ts` as a parent command**

Replace the file contents with:

```ts
import { relative } from 'node:path';
import { cwd } from 'node:process';
import type { Command } from 'commander';
import { createFix } from '../../core/fixes/create.js';
import { updateFixStatus } from '../../core/fixes/transition.js';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFixCommand(program: Command): void {
  const fix = program.command('fix').description('Manage fixes within a feature');

  fix
    .command('create')
    .description("Create a fix inside a feature's fixes/ directory (blocks finish until resolved)")
    .argument('<description>', 'short description of the fix')
    .requiredOption('--feature <slug>', 'feature slug to attach this fix to')
    .option('--json', 'output as structured JSON')
    .action(
      async (
        description: string,
        options: { feature: string; json?: boolean },
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          const projectRoot = cwd();
          const result = await createFix({
            projectRoot,
            description,
            featureSlug: options.feature,
            now: createTimestamp(),
          });

          const path = relative(projectRoot, result.filePath);
          emitSuccess(
            { action: 'fix-create', id: result.id, description, feature: options.feature, path },
            json,
            [
              `Fix created: ${result.id}`,
              `  Description: ${description}`,
              `  Feature: ${options.feature}`,
              `  Path: ${path}`,
            ],
          );
        } catch (error) {
          emitError(error, json);
        }
      },
    );

  registerTransitionSubcommand(fix, 'resolve', 'resolved', 'Mark a fix as resolved');
  registerTransitionSubcommand(fix, 'wont-fix', 'wont-fix', 'Mark a fix as wont-fix');
}

function registerTransitionSubcommand(
  fix: Command,
  name: string,
  targetStatus: 'resolved' | 'wont-fix',
  description: string,
): void {
  fix
    .command(name)
    .description(description)
    .argument('<slug>', 'feature folder slug')
    .argument('<id>', 'fix id (e.g. FIX-0001)')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, id: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const result = await updateFixStatus(cwd(), slug, id, targetStatus);
        emitSuccess(
          { action: `fix-${name}`, ...result },
          json,
          `fix ${result.id} (feature: ${result.feature}): ${result.previousStatus} → ${result.newStatus}`,
        );
      } catch (error) {
        emitError(error, json);
      }
    });
}
```

- [ ] **Step 4: Run the fix + finish tests**

Run: `npx vitest run tests/cli/fix.test.ts tests/cli/finish.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm nothing else used the flat `fix` form**

Run: `grep -rn "'fix'," tests src | grep -v "fix','create\|fix','resolve\|fix','wont-fix"`
Expected: no stray references to the old flat form (other than the parent registration). Fix any that appear.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/fix.ts tests/cli/fix.test.ts
git commit -m "feat(cli): restructure fix into create/resolve/wont-fix subcommands"
```

---

### Task 4: Write the `sf-fix` skill body

**Files:**
- Write: `skills/sf-fix/body.md`
- Modify: `skills/sf-fix/manifest.ts`

This task is prose, not code — no failing test. The "test" is the skill-catalog load (Task 5) and the installed-build check (Task 6). Write the body to mirror `skills/sf-bug/body.md`'s structure and rigor, adapted to the feature-anchored, tracked-artifact flow.

- [ ] **Step 1: Write `skills/sf-fix/body.md`**

```markdown
# sf-fix

You run down ONE defect in an EXISTING feature and drive it to a fix. Unlike
`sf-bug`, the work is anchored to a specific feature — you diagnose against that
feature's original intent (its `spec.md`, `design.md`, and ADRs) — and it leaves
a tracked artifact: a fix recorded under the feature, which blocks `scifi finish`
until you resolve it.

The session has two halves separated by a hard seam: first you investigate
*together* until the cause is understood and a fix is chosen, then you implement
that fix test-first under review. You do not start fixing until the user agrees
on which solution to build.

## The Iron Law

```
IDENTIFY FEATURE → INVESTIGATE → REPORT → AGREE → TRACK → FIX → RESOLVE.
NEVER FIX BEFORE THE USER AGREES.
```

## Flow

### 1. Identify the feature

The fix must attach to one feature. Resolve it before anything else.

- `/sf-fix <slug>` — treat the argument as an exact feature slug. Confirm it
  exists with `scifi status <slug>`.
- `/sf-fix <description>` — you were given prose, not a slug. Run
  `scifi list --json` and match candidate features by slug and title. Present
  your best match (or the candidates, if ambiguous) and **confirm the pick with
  the user**. Never guess silently.
- No feature matches — stop. If it is a defect with no owning feature, point the
  user at `sf-bug` (untracked). If it is really new work, point them at
  `sf-feature`.

Once identified, read the feature's `spec.md` and `design.md`, and grep
`docs/scifi/adr/` for decisions touching the area. Diagnosis is grounded in the
feature's original intent.

**Warn if the feature is not `done`.** A defect in an in-progress feature usually
belongs in `sf-implement`'s own review loop, not a separate tracked fix. Say so,
and proceed only if the user confirms `sf-fix` is what they want.

### 2. Capture the symptom

Pin the symptom in the user's words: the error text *verbatim*, the wrong
output, the failing case. Quote it; do not paraphrase. Note the conditions —
environment, data, version, steps.

### 3. Investigate

Reproduce, then find the root cause. One hypothesis at a time.

- **Reproduce** by the smallest path you can. If you cannot make it happen on
  demand, say so and gather more — an unreproducible defect is not ready to fix.
- **Diagnose**: state a single hypothesis in one sentence, confirm or kill it by
  *reading the code* and adding observation (a log, a probe), not by editing a
  fix and watching the symptom move. When a hypothesis is wrong, record what you
  learned and form the next.
- **Confront against the feature.** Check the behavior against `spec.md` and
  `design.md`. A deviation from the original design is itself a strong lead — and
  if the spec is what's wrong, that is a finding, not a code fix.

You have the root cause when you can trace the full chain from trigger to symptom
and point at the line that is wrong and say why. Investigate openly with the
user — share what you find as you find it.

### 4. Report and propose (the gate)

Stop and bring it back to the user. Present:

- **The issue** — the root cause in plain language: what is actually wrong and
  why it produces the symptom. Not the symptom restated.
- **A few solutions** — typically two or three. For each: what it changes, the
  trade-off, and the blast radius. Be honest about a quick patch vs. a deeper fix
  that removes the cause for good. Recommend one and say why.

Debug it together. Fold in pushback and re-propose. Do not move on until the user
has chosen a solution. If this turns out to be a missing feature or a design
change, stop and route it to `sf-feature` — that is not a fix.

### 5. Track

Only *after* the user has chosen, record the tracked artifact:

```
scifi fix create "<description>" --feature <slug> --json
```

Read the returned `id` (e.g. `FIX-0001`) — you need it to resolve the fix later.
Creating it here, after agreement, keeps the recorded description accurate to the
fix you are about to build.

### 6. Fix, test-first under review

Implement the chosen solution — and only that solution.

- **Hold `sf-tdd`.** The defect becomes its first failing test: write a test that
  reproduces it through the public interface at the smallest scope that captures
  it, watch it fail for the *right* reason (the root cause from step 3), then make
  it pass with the minimal change at the cause. Keep the full suite green.
- **Review gate.** Dispatch a code-review subagent that loads `sf-code-review`,
  then act on its report under `sf-receiving-review` with **review type: code**.
  Re-review until the verdict is **Pass**. Do not skip it and do not review your
  own fix.

### 7. Record and resolve

- Write a **lightweight record** into the fix file body (the file at the `path`
  from step 5): the root cause in one or two sentences, the chosen solution, and
  the regression test that now guards it. Keep it short — this is an audit trail,
  not a spec.
- Close the artifact:

  ```
  scifi fix resolve <slug> <id>
  ```

  This transitions the fix `open → resolved` and unblocks `scifi finish`. Use
  `scifi fix wont-fix <slug> <id>` only if the agreed outcome was deliberately
  not to fix — record why in the body first.

## When you are stuck

| Problem | Move |
| --- | --- |
| Can't reproduce | Shrink the variables: pin env, data, version one at a time. |
| Many possible causes | Bisect — halve the suspect surface each step, don't scan it. |
| Symptom moves when you touch it | You patched downstream of the cause. Go upstream. |
| Fix contradicts the feature's spec/design | Surface it — the spec may be the thing that's wrong. |
| User picks a patch over the real fix | Build it — but record the leftover cause as known debt. |

## Done

The fix is done when:

- the target feature is identified and its context read,
- you can state the root cause in one sentence,
- the user agreed on the solution you built,
- a test reproduces the defect, which you watched fail then pass,
- the code review verdict is **Pass** and the full suite is green,
- the fix file carries the lightweight record and is transitioned to `resolved`
  (or `wont-fix`).

## Hard rules

- Never start fixing before the user has chosen a solution.
- Never fix without first identifying and reading the target feature.
- Never present the symptom as the cause.
- Never ship a fix with no failing test behind it.
- Never leave the tracked fix `open`/`in-progress` once the work is settled —
  resolve it or mark it wont-fix.
- Never mark a fix resolved before the code review verdict is **Pass**.
```

- [ ] **Step 2: Refine the manifest**

Replace the contents of `skills/sf-fix/manifest.ts`:

```ts
import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-fix",
  description:
    "Fix a defect in an existing feature: diagnose against its spec/design with the user, agree on a solution, then fix it test-first under review and record a tracked fix.",
  argumentHint: "[feature-slug | description]",
};
```

- [ ] **Step 3: Commit**

```bash
git add skills/sf-fix/body.md skills/sf-fix/manifest.ts
git commit -m "feat(sf-fix): feature-anchored debug-and-fix flow with tracked artifact"
```

---

### Task 5: Verify the skill catalog loads sf-fix

**Files:**
- Test: existing skill-catalog tests under `tests/core/skills/`

- [ ] **Step 1: Run the full suite + biome gate**

Run: `npm test`
Expected: PASS — all tests green, including any skill-catalog test that builds the manifests and asserts every skill folder has a loadable `manifest` + `body.md`.

Run: `npm run check`
Expected: green (no lint/format errors). If formatting drifts, run `npm run check:fix` and re-run `npm run check`.

- [ ] **Step 2: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: biome formatting for sf-fix flow"
```

(Skip this commit if the working tree is clean after `npm run check`.)

---

### Task 6: Installed-build verification (mandatory per TESTING.md)

**Files:**
- Uses the `.testing/` workspace flow described in `TESTING.md`.

- [ ] **Step 1: Read TESTING.md and run the installed-build flow**

Follow `TESTING.md` to build and install the CLI into the `.testing/` workspace
(e.g. `npm run build` then the documented install step). Do not invent commands —
use the ones `TESTING.md` defines.

- [ ] **Step 2: Exercise the new CLI surface against the installed build**

In the `.testing/` workspace, run (substituting a real feature slug created via
the documented flow):

```
scifi fix create "smoke test fix" --feature <slug> --json
scifi status <slug>          # shows the fix as open
scifi finish <slug>          # blocked: exit 4, lists the open fix
scifi fix resolve <slug> FIX-0001
scifi status <slug>          # shows the fix as resolved
scifi finish <slug>          # now succeeds
```

Expected: create prints `FIX-0001`; `finish` is blocked while the fix is open and
succeeds after resolve.

- [ ] **Step 3: Verify the skill installs**

Run `scifi init` (or the documented install step) in the `.testing/` workspace
and confirm `sf-fix` lands in the harness skills directory with the refined
manifest description and a non-placeholder `body.md`.

- [ ] **Step 4: Record the verification outcome**

Note the commands run and their observed output in the PR description. Do not mark
the work complete until this installed-build check has passed.

---

## Final: open the pull request

- [ ] Confirm `npm test` and `npm run check` are green and the installed-build
  check passed.
- [ ] Push `feat/sf-fix-flow` and open a PR against `main` with conventional-commit
  title (`feat: sf-fix feature-anchored fix flow`), summarizing the skill, the CLI
  restructure (note the breaking `fix` → `fix create` change), and the
  installed-build verification output. Leave merging to the maintainer.
