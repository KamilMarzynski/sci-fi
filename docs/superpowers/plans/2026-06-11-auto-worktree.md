# Automatic per-feature worktree + branch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every feature gets its own git branch + worktree automatically at `sf-feature` inception, so several features run in parallel in isolation; the CLI records the branch/worktree pointer it is handed.

**Architecture:** Hybrid. Skills run git (`git worktree add -b feat/<slug> .worktrees/feat-<slug> <default-branch>`); the CLI gains a thin `scifi worktree set` command that records `branch` + `worktreePath` onto the feature's `.scifi.json` and reports them in `scifi status`. The CLI itself never shells to git.

**Tech Stack:** TypeScript (strict, no `any`, no casts), Node ≥22, commander, vitest, Biome. Spec lives at `docs/superpowers/specs/2026-06-11-auto-worktree-design.md`.

**Base branch:** This branch (`feat/auto-worktree`) is rebased on `origin/main`, which already contains the merged `fix/skill-consistency` work. Edit the skill files as they stand now.

---

## File Structure

**Create:**
- `src/core/specs/worktree.ts` — `setFeatureWorktree(projectRoot, slug, { branch, path })`: validates inputs, reads metadata, writes the two pointer fields back. One responsibility: the pointer write.
- `src/cli/commands/worktree.ts` — `scifi worktree set` command wiring (thin).
- `tests/core/specs/worktree.test.ts` — core unit tests + the cross-transition preservation regression.
- `tests/cli/worktree.test.ts` — command-level tests.

**Modify:**
- `src/core/specs/types.ts` — add optional `branch?` / `worktreePath?` to `FeatureMetadata`.
- `src/core/specs/transition.ts` — carry the pointer through `updateFeatureStatus`'s metadata rebuild.
- `src/cli/commands/status.ts` — surface `branch` / `worktree` in JSON + human output.
- `src/cli/index.ts` — register the new command.
- `tests/cli/status.test.ts` — assert the pointer surfaces.
- `tests/e2e/installed-lifecycle.test.ts` — installed-build coverage for `worktree set` → `status`.
- Skills: `sf-feature`, `sf-plan`, `sf-implement`, `sf-continue`, `sf-change`, `sf-fix`, `sf-bug` bodies.
- `README.md`, `ROADMAP.md`.

---

## Task 1: Core — `setFeatureWorktree` + metadata fields

**Files:**
- Modify: `src/core/specs/types.ts:11-19`
- Create: `src/core/specs/worktree.ts`
- Test: `tests/core/specs/worktree.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/specs/worktree.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { updateFeatureStatus } from '../../../src/core/specs/transition.js';
import { setFeatureWorktree } from '../../../src/core/specs/worktree.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function createFeatureAt(projectRoot: string, slug: string): Promise<void> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.scifi.json'),
    `${JSON.stringify(
      {
        version: 1,
        id: 'FEAT-0001',
        slug,
        status: 'created',
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function readMetadata(
  projectRoot: string,
  slug: string,
): Promise<{ branch?: string; worktreePath?: string; status: string }> {
  const raw = await readFile(
    join(projectRoot, 'docs', 'scifi', 'specs', slug, '.scifi.json'),
    'utf8',
  );
  return JSON.parse(raw) as { branch?: string; worktreePath?: string; status: string };
}

describe('setFeatureWorktree', () => {
  it('records branch and worktree path on the feature metadata', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');

    const result = await setFeatureWorktree(projectRoot, 'google-auth', {
      branch: 'feat/google-auth',
      path: '.worktrees/feat-google-auth',
    });

    expect(result).toEqual({
      id: 'FEAT-0001',
      slug: 'google-auth',
      branch: 'feat/google-auth',
      worktreePath: '.worktrees/feat-google-auth',
    });

    const metadata = await readMetadata(projectRoot, 'google-auth');
    expect(metadata.branch).toBe('feat/google-auth');
    expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');
    expect(metadata.status).toBe('created');
  });

  it('rejects an empty branch', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');

    await expect(
      setFeatureWorktree(projectRoot, 'google-auth', { branch: '   ', path: '.worktrees/x' }),
    ).rejects.toThrow('Branch must not be empty');
  });

  it('throws NOT_FOUND for a missing feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);

    await expect(
      setFeatureWorktree(projectRoot, 'ghost', {
        branch: 'feat/ghost',
        path: '.worktrees/feat-ghost',
      }),
    ).rejects.toThrow('does not exist');
  });

  it('preserves the worktree pointer across a status transition', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');
    await writeFile(
      join(projectRoot, 'docs', 'scifi', 'specs', 'google-auth', 'spec.md'),
      '# Spec\n',
      'utf8',
    );
    await setFeatureWorktree(projectRoot, 'google-auth', {
      branch: 'feat/google-auth',
      path: '.worktrees/feat-google-auth',
    });

    await updateFeatureStatus(projectRoot, 'google-auth', 'spec-ready', '2026-06-11T10:00:00Z');

    const metadata = await readMetadata(projectRoot, 'google-auth');
    expect(metadata.status).toBe('spec-ready');
    expect(metadata.branch).toBe('feat/google-auth');
    expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- worktree.test`
Expected: FAIL — `setFeatureWorktree` is not exported from `worktree.js` (module not found).

- [ ] **Step 3: Add the metadata fields**

In `src/core/specs/types.ts`, extend the interface:

```ts
export interface FeatureMetadata {
  version: 1;
  id: string;
  slug: string;
  title?: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
  branch?: string;
  worktreePath?: string;
}
```

- [ ] **Step 4: Implement the core module**

Create `src/core/specs/worktree.ts`:

```ts
import { writeFile } from 'node:fs/promises';
import { ScifiError } from '../output/errors.js';
import { inspectFeatureLifecycle } from './lifecycle.js';
import { buildFeatureMetadataPath } from './paths.js';
import type { FeatureMetadata } from './types.js';

export interface SetFeatureWorktreeInput {
  branch: string;
  path: string;
}

export interface SetFeatureWorktreeResult {
  id: string;
  slug: string;
  branch: string;
  worktreePath: string;
}

export async function setFeatureWorktree(
  projectRoot: string,
  slug: string,
  input: SetFeatureWorktreeInput,
): Promise<SetFeatureWorktreeResult> {
  const branch = input.branch.trim();
  const worktreePath = input.path.trim();

  if (branch.length === 0) {
    throw new ScifiError('INVALID_ARGUMENT', 'Branch must not be empty.', {
      hint: 'Pass --branch <branch-name>.',
    });
  }
  if (worktreePath.length === 0) {
    throw new ScifiError('INVALID_ARGUMENT', 'Worktree path must not be empty.', {
      hint: 'Pass --path <worktree-path>.',
    });
  }

  const { metadata } = await inspectFeatureLifecycle(projectRoot, slug);

  const updatedMetadata: FeatureMetadata = {
    ...metadata,
    branch,
    worktreePath,
  };

  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);
  await writeFile(metadataPath, `${JSON.stringify(updatedMetadata, null, 2)}\n`, 'utf8');

  return {
    id: metadata.id,
    slug: metadata.slug,
    branch,
    worktreePath,
  };
}
```

(`inspectFeatureLifecycle` already throws `NOT_FOUND` when the feature is absent, satisfying that test.)

- [ ] **Step 5: Run the test to verify it passes (and confirm the preservation test still fails)**

Run: `npm test -- worktree.test`
Expected: the three `setFeatureWorktree` tests PASS; the **"preserves the worktree pointer across a status transition"** test FAILS — `updateFeatureStatus` drops `branch`/`worktreePath` (next task fixes it).

- [ ] **Step 6: Commit**

```bash
git add src/core/specs/types.ts src/core/specs/worktree.ts tests/core/specs/worktree.test.ts
git commit -m "feat(core): record a feature's branch + worktree pointer"
```

---

## Task 2: Preserve the pointer across status transitions

**Files:**
- Modify: `src/core/specs/transition.ts:30-43`
- Test: `tests/core/specs/worktree.test.ts` (the preservation test from Task 1)

- [ ] **Step 1: Confirm the failing test**

Run: `npm test -- worktree.test`
Expected: "preserves the worktree pointer across a status transition" FAILS (`metadata.branch` is `undefined` after the transition).

- [ ] **Step 2: Thread the fields through the metadata rebuild**

In `src/core/specs/transition.ts`, replace the `updatedMetadata` object:

```ts
  const metadata = lifecycle.metadata;
  const updatedMetadata: FeatureMetadata = {
    version: metadata.version,
    id: metadata.id,
    slug: metadata.slug,
    ...(metadata.title !== undefined && { title: metadata.title }),
    status: targetStatus,
    createdAt: metadata.createdAt,
    updatedAt: now,
    ...(metadata.branch !== undefined && { branch: metadata.branch }),
    ...(metadata.worktreePath !== undefined && { worktreePath: metadata.worktreePath }),
  };
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- worktree.test`
Expected: all four tests PASS.

- [ ] **Step 4: Run the existing transition suite to confirm no regression**

Run: `npm test -- transition.test`
Expected: PASS (all existing cases unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/core/specs/transition.ts
git commit -m "fix(core): keep the worktree pointer across status transitions"
```

---

## Task 3: `scifi worktree set` command

**Files:**
- Create: `src/cli/commands/worktree.ts`
- Modify: `src/cli/index.ts:9-19,46-56`
- Test: `tests/cli/worktree.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/worktree.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './helpers.js';

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function scaffoldFeature(projectRoot: string, slug: string): Promise<void> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.scifi.json'),
    JSON.stringify({
      version: 1,
      id: 'FEAT-0001',
      slug,
      status: 'created',
      createdAt: '2026-06-11T00:00:00Z',
      updatedAt: '2026-06-11T00:00:00Z',
    }),
    'utf8',
  );
}

describe('worktree set command', () => {
  it('records the branch and worktree path and reports them', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);
    await scaffoldFeature(projectRoot, 'google-auth');

    const run = await runCli([
      'worktree',
      'set',
      'google-auth',
      '--branch',
      'feat/google-auth',
      '--path',
      '.worktrees/feat-google-auth',
    ]);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('feat/google-auth');
    expect(run.stdout).toContain('.worktrees/feat-google-auth');

    const metadata = JSON.parse(
      await readFile(
        join(projectRoot, 'docs', 'scifi', 'specs', 'google-auth', '.scifi.json'),
        'utf8',
      ),
    ) as { branch?: string; worktreePath?: string };
    expect(metadata.branch).toBe('feat/google-auth');
    expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');
  });

  it('errors with NOT_FOUND for an unknown feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli([
      'worktree',
      'set',
      'ghost',
      '--branch',
      'feat/ghost',
      '--path',
      '.worktrees/feat-ghost',
      '--json',
    ]);

    expect(run.exitCode).toBe(3);
    expect(run.stderr).toContain('NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- cli/worktree`
Expected: FAIL — `worktree` is an unknown command (Commander error / non-zero unexpected, or NOT a clean exit 0).

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/worktree.ts`:

```ts
import { cwd } from 'node:process';
import type { Command } from 'commander';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';
import { setFeatureWorktree } from '../../core/specs/worktree.js';

export function registerWorktreeCommand(program: Command): void {
  const worktree = program
    .command('worktree')
    .description('Manage the git branch + worktree pointer recorded on a feature');

  worktree
    .command('set')
    .description('Record the git branch and worktree path backing a feature')
    .argument('<slug>', 'feature folder slug')
    .requiredOption('--branch <branch>', 'git branch backing the feature')
    .requiredOption('--path <path>', 'worktree path backing the feature')
    .option('--json', 'output as structured JSON')
    .action(
      async (
        slug: string,
        options: { branch: string; path: string; json?: boolean },
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          const result = await setFeatureWorktree(cwd(), slug, {
            branch: options.branch,
            path: options.path,
          });
          emitSuccess({ action: 'worktree-set', ...result }, json, [
            `feature ${result.slug}: worktree recorded`,
            `  branch:   ${result.branch}`,
            `  worktree: ${result.worktreePath}`,
          ]);
        } catch (error) {
          emitError(error, json);
        }
      },
    );
}
```

- [ ] **Step 4: Register the command**

In `src/cli/index.ts`, add the import alongside the others (after the `task` import, line ~19):

```ts
import { registerWorktreeCommand } from './commands/worktree.js';
```

And register it in `buildProgram()` after `registerFixCommand(program);`:

```ts
  registerFixCommand(program);
  registerWorktreeCommand(program);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- cli/worktree`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/worktree.ts src/cli/index.ts tests/cli/worktree.test.ts
git commit -m "feat(cli): add scifi worktree set"
```

---

## Task 4: Surface branch + worktree in `scifi status`

**Files:**
- Modify: `src/cli/commands/status.ts:24-57`
- Test: `tests/cli/status.test.ts`

- [ ] **Step 1: Write the failing test**

Append this case inside the `describe('status command', ...)` block in `tests/cli/status.test.ts`:

```ts
  it('prints the recorded branch and worktree when present', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'google-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      JSON.stringify({
        version: 1,
        id: 'FEAT-0001',
        slug: 'google-auth',
        status: 'created',
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z',
        branch: 'feat/google-auth',
        worktreePath: '.worktrees/feat-google-auth',
      }),
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'scifi', 'status', 'google-auth']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('feat/google-auth');
    expect(combined).toContain('.worktrees/feat-google-auth');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- cli/status`
Expected: FAIL — the new case's `toContain('feat/google-auth')` fails (status does not print it yet).

- [ ] **Step 3: Add branch/worktree to the status output**

In `src/cli/commands/status.ts`, update the `data` object to include the pointer (insert after the `status` line):

```ts
        const data = {
          slug: metadata.slug,
          id: metadata.id,
          ...(metadata.title !== undefined && { title: metadata.title }),
          status: metadata.status,
          ...(metadata.branch !== undefined && { branch: metadata.branch }),
          ...(metadata.worktreePath !== undefined && { worktree: metadata.worktreePath }),
          artifacts: {
            spec: artifacts.specExists,
            design: artifacts.designExists,
            taskCount: artifacts.taskFileCount,
          },
          tasks: tasks.map((task) => ({ slug: task.slug, status: task.status })),
          fixes: fixes.map((fix) => ({
            id: fix.id,
            slug: fix.slug,
            status: fix.status,
          })),
        };
```

And add the human lines right after the `status:` line in `humanLines`:

```ts
          `status:  ${metadata.status}`,
          ...(metadata.branch !== undefined ? [`branch:  ${metadata.branch}`] : []),
          ...(metadata.worktreePath !== undefined ? [`worktree: ${metadata.worktreePath}`] : []),
          ``,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- cli/status`
Expected: PASS (new case + the three existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/status.ts tests/cli/status.test.ts
git commit -m "feat(cli): report branch + worktree in scifi status"
```

---

## Task 5: Installed-build e2e coverage

**Files:**
- Modify: `tests/e2e/installed-lifecycle.test.ts`

- [ ] **Step 1: Write the failing e2e test**

Add this `it` block inside the top-level `describe` in `tests/e2e/installed-lifecycle.test.ts` (it uses the existing `runInstalledCommand` + `createInstalledPackageTestEnvironment` helpers already imported there):

```ts
  it('records and reports a feature worktree pointer against the installed build', () => {
    const installation = createInstalledPackageTestEnvironment('installed-worktree-');
    try {
      const dir = installation.installDirectory;
      runInstalledCommand(dir, ['init', '--harness', 'claude-code', '--yes']);
      runInstalledCommand(dir, ['spec', 'google-auth', '--title', 'Google Auth']);

      const setResult = runInstalledCommand(dir, [
        'worktree',
        'set',
        'google-auth',
        '--branch',
        'feat/google-auth',
        '--path',
        '.worktrees/feat-google-auth',
      ]);
      expect(setResult.status).toBe(0);

      const metadata = JSON.parse(
        readFileSync(
          join(dir, 'docs', 'scifi', 'specs', 'google-auth', '.scifi.json'),
          'utf8',
        ),
      ) as { branch?: string; worktreePath?: string };
      expect(metadata.branch).toBe('feat/google-auth');
      expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');

      const statusResult = runInstalledCommand(dir, ['status', 'google-auth', '--json']);
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('feat/google-auth');
      expect(statusResult.stdout).toContain('.worktrees/feat-google-auth');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
```

Confirm the file's imports include `createInstalledPackageTestEnvironment`, `cleanupInstalledPackageTestEnvironment`, `runInstalledCommand` from `./installed-test-helpers.js`, plus `readFileSync` from `node:fs` and `join` from `node:path`. Add any that are missing to the existing import lines.

- [ ] **Step 2: Run it to verify it fails against the current installed build**

Run: `npm test -- installed-lifecycle`
Expected: FAIL — the packed build predates `worktree set` (unknown command / non-zero status). The pack step rebuilds from source, so once the command exists this passes; if the harness uses a stale pack, run `npm run build` first.

- [ ] **Step 3: Ensure the build is current, then re-run**

Run: `npm run build && npm test -- installed-lifecycle`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/installed-lifecycle.test.ts
git commit -m "test(e2e): verify worktree set against the installed build"
```

---

## Task 6: `sf-feature` — create the worktree at inception

**Files:**
- Modify: `skills/sf-feature/body.md`

- [ ] **Step 1: Add the workspace-creation step (new features)**

In `skills/sf-feature/body.md`, in **"### 1. Name and create (or reopen) the container"**, under the **"Otherwise, for genuinely new work,"** list, insert a new first bullet *before* "Derive a short kebab-case slug" — actually keep slug derivation first, then insert the worktree step immediately after the slug/issue bullets and before "Create the container:". Insert:

```markdown
- **Create the feature's branch and worktree (this is automatic now).** From the
  repository's default/integration branch (usually `main`), run:

  ```
  git worktree add -b feat/<slug> .worktrees/feat-<slug> main
  ```

  This gives the feature an isolated workspace so several features can be in
  flight at once without colliding. Work from inside `.worktrees/feat-<slug>`
  for the rest of this skill and for planning and implementation. If the path
  already exists, the feature was started before — treat this as the reopen case
  above instead of creating a second worktree.
```

- [ ] **Step 2: Record the pointer after creating the container**

Still in step 1, immediately after the `scifi spec <slug> --title "<human title>" --json` block and its sub-bullets, add:

```markdown
- Record the workspace on the feature so status and resume can find it:

  ```
  scifi worktree set <slug> --branch feat/<slug> --path .worktrees/feat-<slug>
  ```
```

- [ ] **Step 3: Update the reopen paragraph to mention the existing worktree**

Replace the reopen paragraph (the one beginning "**If you were sent here to resume or reopen an existing feature**") tail so it reads:

```markdown
the spec stage — the container already exists. Do **not** run `scifi spec`; it
would `CONFLICT`. Confirm the feature with `scifi status <slug> --json`; its
worktree is reported as `worktree` (fallback: `.worktrees/feat-<slug>`). Enter
that worktree and go straight to grilling against the spec that is already
there. Skip the rest of this step.
```

- [ ] **Step 4: Verify the skill still builds into the catalog**

Run: `npm run build && npm test -- bundled-catalog`
Expected: PASS (13 skills, ids unchanged).

- [ ] **Step 5: Commit**

```bash
git add skills/sf-feature/body.md
git commit -m "docs(skills): create the feature worktree + branch in sf-feature"
```

---

## Task 7: Wire the remaining skills to the worktree

**Files:**
- Modify: `skills/sf-implement/body.md`, `skills/sf-plan/body.md`, `skills/sf-continue/body.md`, `skills/sf-change/body.md`, `skills/sf-fix/body.md`, `skills/sf-bug/body.md`

- [ ] **Step 1: `sf-implement` — drop the "branch creation is yours" caveat**

In `skills/sf-implement/body.md`, in **"### 1. Start the feature"**, replace the parenthetical at the end of the "**Record the base commit.**" paragraph:

Find:

```
recover it from the git log if you no longer have it. (The CLI does not manage
git — branch creation and commits are yours and the implementers'.)
```

Replace with:

```
recover it from the git log if you no longer have it. The feature's branch and
worktree already exist (created by `sf-feature`); confirm you are inside it —
`scifi status <slug> --json` reports the `worktree` path. The CLI does not run
git; commits are yours and the implementers'.
```

- [ ] **Step 2: `sf-plan` — note the session runs in the worktree**

In `skills/sf-plan/body.md`, in **"## Long-term memory"**, after the line introducing `<path>`, add a sentence:

```markdown
Run this session inside the feature's worktree (created by `sf-feature`);
`scifi status <slug> --json` reports its `worktree` path. On a resumed run, enter
that worktree before reading or writing anything.
```

- [ ] **Step 3: `sf-continue` — route via the recorded worktree**

In `skills/sf-continue/body.md`, in **"### 2. Read the state"**, extend the field list (the paragraph beginning "Read `status`, the `artifacts` inventory") to add the worktree pointer:

```markdown
Also read `worktree` (and `branch`) when present — the feature's isolated
workspace. Enter that worktree before handing off to the owning skill; fall back
to `.worktrees/feat-<slug>` (confirm with `git worktree list`) if the field is
absent or the recorded path is gone.
```

- [ ] **Step 4: `sf-change` — operate in the existing worktree**

In `skills/sf-change/body.md`, in **"### 2. Assess current state"**, after the `scifi status <slug> --json` paragraph, add:

```markdown
Enter the feature's worktree (the `worktree` field, fallback
`.worktrees/feat-<slug>`) before editing any artifact. If the feature was `done`
and its worktree was cleaned up, recreate one off the default branch
(`git worktree add -b feat/<slug> .worktrees/feat-<slug> main`) and re-record it
with `scifi worktree set <slug> --branch feat/<slug> --path .worktrees/feat-<slug>`.
```

- [ ] **Step 5: `sf-fix` — create a fix worktree up front**

In `skills/sf-fix/body.md`, at the end of **"### 1. Identify the feature"**, add:

```markdown
Create an isolated workspace for the fix before investigating:

```
git worktree add -b fix/<slug> .worktrees/fix-<slug> main
```

where `<slug>` is the feature slug (or a short fix-specific slug if you are
fixing several defects in one feature). Work inside it; open the PR from it.
```

- [ ] **Step 6: `sf-bug` — create a fix worktree up front**

In `skills/sf-bug/body.md`, at the end of **"### 1. Capture the report"**, add:

```markdown
Before investigating, create an isolated workspace from the default branch:

```
git worktree add -b fix/<slug> .worktrees/fix-<slug> main
```

Derive `<slug>` from the bug (e.g. `stale-token-refresh`). Work inside it; open
the PR from it. A bug is untracked, so there is no `scifi` pointer to record.
```

- [ ] **Step 7: Verify the catalog still builds**

Run: `npm run build && npm test -- bundled-catalog install-skills`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add skills/sf-implement/body.md skills/sf-plan/body.md skills/sf-continue/body.md skills/sf-change/body.md skills/sf-fix/body.md skills/sf-bug/body.md
git commit -m "docs(skills): run each flow inside the feature worktree"
```

---

## Task 8: Docs — README + ROADMAP

**Files:**
- Modify: `README.md`, `ROADMAP.md`

- [ ] **Step 1: Document the behavior in README**

In `README.md`, in the CLI reference table, add a row (after the `scifi status` row):

```markdown
| `scifi worktree set <slug> --branch <b> --path <p>` | Record the branch + worktree backing a feature |
```

And in the prose where the everyday flow / "What makes it work" is described, add a short paragraph:

```markdown
- **Isolated per feature.** Starting a feature with `sf-feature` creates its own
  git branch (`feat/<slug>`) and worktree (`.worktrees/feat-<slug>`) up front, so
  several features can be built in parallel without colliding, and nothing lands
  on the default branch until the feature's PR merges. `scifi status` reports the
  branch and worktree; the maintainer removes the worktree after the PR merges.
```

- [ ] **Step 2: Record the known limitations in ROADMAP**

`ROADMAP.md` does not exist at the repo root yet — create it with a `## Known Debt`
section (it is a dev doc; `scifi init` does not scaffold it, and the installed
e2e that asserts `ROADMAP.md` is absent checks the sandbox project, not this
repo). Write:

```markdown
# Roadmap

## Known Debt

- **Feature-ID collision across parallel branches.** `FEAT-NNNN` is derived from
  the count of `specs/` dirs on the current branch, so two features branched from
  the same default branch can compute the same next id until merged. The slug is
  the real key, so this is cosmetic. Revisit if ids ever become load-bearing.
- **Cross-branch feature discovery.** `scifi list` on the default branch does not
  show in-flight features (their `specs/<slug>/` lives on the feature branch).
  Discovery across features is via `git worktree list`. Inherent to per-feature
  isolation; revisit if a global in-flight view is needed.
```

- [ ] **Step 3: Verify markdown is clean**

Run: `npm run check`
Expected: PASS (Biome ignores prose content; confirms no formatting breakage).

- [ ] **Step 4: Commit**

```bash
git add README.md ROADMAP.md
git commit -m "docs: document automatic per-feature worktrees + known debt"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: clean (no output / exit 0).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Lint + format**

Run: `npm run check`
Expected: "No fixes applied", exit 0. If it flags anything, run `npm run check:fix` and re-commit.

- [ ] **Step 4: Full test suite (incl. installed build)**

Run: `npm test`
Expected: all files pass, including `worktree.test`, `cli/worktree`, `cli/status`, and `installed-lifecycle`.

- [ ] **Step 5: Coverage (core logic)**

Run: `npm run coverage`
Expected: `src/core/specs/worktree.ts` covered; overall coverage not reduced.

- [ ] **Step 6: Final commit if anything changed**

```bash
git add -A
git commit -m "chore: verification fixups for auto-worktree" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- Worktree at inception → Task 6. Branch/worktree naming → Tasks 6/7 (skill text). CLI records pointer → Tasks 1–4. `scifi status` reports it → Task 4. Resume finds it → Tasks 6/7 (sf-continue/sf-change). sf-bug/sf-fix worktrees → Task 7. README + ROADMAP debt → Task 8. Installed-build verification → Task 5. Preservation-across-transition (the subtle field-drop) → Tasks 1–2. All spec sections map to a task.
- Not automated (per spec non-goals): worktree removal, configurable root, default-branch auto-detection. The skill text uses `main` as the explicit base and notes "default/integration branch (usually `main`)"; teams on a differently-named default substitute it. Acceptable per design.

**Placeholder scan:** No TBD/TODO; every code and doc step shows the actual content.

**Type consistency:** `setFeatureWorktree(projectRoot, slug, { branch, path })` → `{ id, slug, branch, worktreePath }` is used identically in core, command, and tests. Metadata fields `branch` / `worktreePath` are named consistently across `types.ts`, `transition.ts`, `worktree.ts`, `status.ts`, and the skill `scifi worktree set --branch/--path` flags (note: the CLI flag is `--path`, stored as `worktreePath`; status JSON exposes it as `worktree` — intentional and consistent across Task 3/4 and the skill text).
