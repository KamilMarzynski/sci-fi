import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';
import { readFixFile } from '../../src/core/fixes/frontmatter.js';
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
      slug,
      status: 'in-progress',
      createdAt: '2026-05-21T00:00:00Z',
      updatedAt: '2026-05-21T00:00:00Z',
    }),
    'utf8',
  );
}

/**
 * Like scaffoldFeature but also adds a done task so that `finish` can
 * succeed once all open fixes are resolved.
 */
async function scaffoldFeatureWithDoneTask(projectRoot: string, slug: string): Promise<void> {
  await scaffoldFeature(projectRoot, slug);
  const tasksDir = join(projectRoot, 'docs', 'scifi', 'specs', slug, 'tasks');
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, 'setup.md'),
    '---\nid: TASK-001\nslug: setup\nstatus: done\ndepends-on: []\n---\n# Setup\n',
    'utf8',
  );
}

describe('fix command', () => {
  it("creates a fix file inside the feature's fixes/ dir and prints id and path", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);
    await scaffoldFeature(projectRoot, 'auth-flow');

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync([
        'node',
        'scifi',
        'fix',
        'create',
        'token expiry off by one',
        '--feature',
        'auth-flow',
      ]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('FIX-0001');
    expect(combined).toContain('token-expiry-off-by-one');

    const fixPath = join(
      projectRoot,
      'docs',
      'scifi',
      'specs',
      'auth-flow',
      'fixes',
      'FIX-0001-token-expiry-off-by-one.md',
    );
    const file = await readFixFile(fixPath);
    expect(file.frontmatter.feature).toBe('auth-flow');
    expect(file.frontmatter.status).toBe('open');
  });

  it('fails when --feature flag is omitted', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await expect(
      buildProgram().parseAsync(['node', 'scifi', 'fix', 'create', 'some description']),
    ).rejects.toThrow();
  });

  it('fails when the feature slug does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(['fix', 'create', 'some description', '--feature', 'nonexistent']);
    expect(run.exitCode).toBe(3);
    expect(run.stderr).toContain('Feature "nonexistent" does not exist.');
    expect(run.stderr).toContain('NOT_FOUND');
  });

  it('resolves an open fix via `fix resolve`', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);
    await scaffoldFeature(projectRoot, 'auth-flow');

    await runCli(['fix', 'create', 'token expiry off by one', '--feature', 'auth-flow']);
    const run = await runCli(['fix', 'resolve', 'auth-flow', 'FIX-0001']);

    expect(run.exitCode).toBe(0);
    const file = await readFixFile(
      join(
        projectRoot,
        'docs',
        'scifi',
        'specs',
        'auth-flow',
        'fixes',
        'FIX-0001-token-expiry-off-by-one.md',
      ),
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
      join(
        projectRoot,
        'docs',
        'scifi',
        'specs',
        'auth-flow',
        'fixes',
        'FIX-0001-token-expiry-off-by-one.md',
      ),
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
    // Use a feature with a done task so that finish only blocks on open fixes.
    await scaffoldFeatureWithDoneTask(projectRoot, 'auth-flow');

    await runCli(['fix', 'create', 'token expiry off by one', '--feature', 'auth-flow']);
    const blocked = await runCli(['finish', 'auth-flow']);
    expect(blocked.exitCode).toBe(4);

    await runCli(['fix', 'resolve', 'auth-flow', 'FIX-0001']);
    const finished = await runCli(['finish', 'auth-flow']);
    expect(finished.exitCode).toBe(0);
  });
});
