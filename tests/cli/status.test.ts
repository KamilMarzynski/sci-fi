import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';

const execFileAsync = promisify(execFile);

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function runStatus(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode?: number }> {
  const stdoutOutput: string[] = [];
  const stderrOutput: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') stdoutOutput.push(chunk);
    return true;
  };
  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') stderrOutput.push(chunk);
    return true;
  };

  try {
    await buildProgram().parseAsync(['node', 'scifi', 'status', ...args]);
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  const exitCode = process.exitCode;
  process.exitCode = previousExitCode;
  return {
    stdout: stdoutOutput.join(''),
    stderr: stderrOutput.join(''),
    exitCode,
  };
}

describe('status command', () => {
  it('prints lifecycle snapshot for a feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    const tasksDir = join(featureDir, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'user-auth',
          title: 'User Auth',
          status: 'in-progress',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: done\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const { stdout } = await runStatus(['user-auth']);

    expect(stdout).toContain('user-auth');
    expect(stdout).toContain('in-progress');
    expect(stdout).toContain('spec.md');
    expect(stdout).toContain('design.md');
    expect(stdout).toContain('setup-db');
    expect(stdout).toContain('done');
  });

  it('prints fixes block when feature has open fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    const fixesDir = join(featureDir, 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'in-progress',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
      }),
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      '---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n',
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0002-null-ptr.md'),
      '---\nid: FIX-0002\nslug: null-ptr\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# null ptr\n',
      'utf8',
    );

    const { stdout } = await runStatus(['user-auth']);

    expect(stdout).toContain('fixes:');
    expect(stdout).toContain('FIX-0001');
    expect(stdout).toContain('token-expiry');
    expect(stdout).toContain('FIX-0002');
    expect(stdout).toContain('null-ptr');
  });

  it('omits fixes block when feature has no fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'in-progress',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
      }),
      'utf8',
    );

    const { stdout } = await runStatus(['user-auth']);

    expect(stdout).not.toContain('fixes:');
  });

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
        slug: 'google-auth',
        status: 'created',
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z',
        branch: 'feat/google-auth',
        worktreePath: '.worktrees/feat-google-auth',
      }),
      'utf8',
    );

    const { stdout } = await runStatus(['google-auth']);

    expect(stdout).toContain('feat/google-auth');
    expect(stdout).toContain('.worktrees/feat-google-auth');
  });

  it('resolves a worktree-only feature and prints its location', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    const worktreeRoot = join(projectRoot, '.worktrees', 'feat-payment-flow');
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await execFileAsync('git', ['init'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot });

    const mainSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs');
    await mkdir(join(mainSpecsDir, 'user-auth'), { recursive: true });
    await writeFile(
      join(mainSpecsDir, 'user-auth', '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'user-auth',
          status: 'created',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: projectRoot });

    await execFileAsync('git', ['worktree', 'add', '-b', 'feat/payment-flow', worktreeRoot], {
      cwd: projectRoot,
    });

    const worktreeFeatureDir = join(worktreeRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    const worktreeTasksDir = join(worktreeFeatureDir, 'tasks');
    const worktreeFixesDir = join(worktreeFeatureDir, 'fixes');
    await mkdir(worktreeFeatureDir, { recursive: true });
    await mkdir(worktreeTasksDir, { recursive: true });
    await mkdir(worktreeFixesDir, { recursive: true });
    await writeFile(
      join(worktreeFeatureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'payment-flow',
          title: 'Payment Flow',
          status: 'spec-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(worktreeFeatureDir, 'spec.md'), '# Payment Flow\n', 'utf8');
    await writeFile(
      join(worktreeTasksDir, 'setup-gateway.md'),
      '---\nid: TASK-001\nslug: setup-gateway\nstatus: in-progress\ndepends-on: []\n---\n# Setup Gateway\n',
      'utf8',
    );
    await writeFile(
      join(worktreeFixesDir, 'FIX-0001-timeout.md'),
      '---\nid: FIX-0001\nslug: timeout\nstatus: open\nfeature: payment-flow\ncreated: 2026-05-21T00:00:00.000Z\n---\n# timeout\n',
      'utf8',
    );

    const { stdout } = await runStatus(['payment-flow']);

    expect(stdout).toContain('payment-flow');
    expect(stdout).toContain('spec-ready');
    expect(stdout).toContain(`worktree:${await realpath(worktreeRoot)}`);
    expect(stdout).toContain('location:');
    expect(stdout).toContain('setup-gateway');
    expect(stdout).toContain('FIX-0001');
    expect(stdout).toContain('timeout');
  });

  it('includes location in json output for a local feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'local-feature');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      JSON.stringify({
        version: 1,
        slug: 'local-feature',
        status: 'created',
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z',
      }),
      'utf8',
    );

    const { stdout } = await runStatus(['local-feature', '--json']);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.location).toBe('local');
  });

  it('includes location in json output for a worktree-only feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    const worktreeRoot = join(projectRoot, '.worktrees', 'feat-worktree-feature');
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await execFileAsync('git', ['init'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot });

    const mainSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs');
    await mkdir(join(mainSpecsDir, 'user-auth'), { recursive: true });
    await writeFile(
      join(mainSpecsDir, 'user-auth', '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'user-auth',
          status: 'created',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: projectRoot });

    await execFileAsync('git', ['worktree', 'add', '-b', 'feat/worktree-feature', worktreeRoot], {
      cwd: projectRoot,
    });

    const worktreeFeatureDir = join(worktreeRoot, 'docs', 'scifi', 'specs', 'worktree-feature');
    await mkdir(worktreeFeatureDir, { recursive: true });
    await writeFile(
      join(worktreeFeatureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'worktree-feature',
          status: 'spec-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const { stdout } = await runStatus(['worktree-feature', '--json']);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.location).toBe(`worktree:${await realpath(worktreeRoot)}`);
  });

  it('preserves NOT_FOUND and omits location for a missing feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const { stderr, exitCode } = await runStatus(['missing-feature', '--json']);

    const parsed = JSON.parse(stderr);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('NOT_FOUND');
    expect(parsed.data).toBeUndefined();
    expect(exitCode).toBe(3);
  });
});
