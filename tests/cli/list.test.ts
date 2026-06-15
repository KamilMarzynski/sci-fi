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

async function writeFeatureMetadata(
  projectRoot: string,
  slug: string,
  status: string,
): Promise<void> {
  const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');
  await mkdir(join(specsDir, slug), { recursive: true });
  await writeFile(
    join(specsDir, slug, '.scifi.json'),
    `${JSON.stringify(
      {
        version: 1,
        slug,
        status,
        createdAt: '2026-05-20T00:00:00Z',
        updatedAt: '2026-05-20T00:00:00Z',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function captureStdout(args: string[]): Promise<string> {
  const output: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') output.push(chunk);
    return true;
  };

  try {
    await buildProgram().parseAsync(['node', 'scifi', ...args]);
  } finally {
    process.stdout.write = originalWrite;
  }

  return output.join('');
}

describe('list command', () => {
  it('prints all features when no filter applied', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');
    await mkdir(join(specsDir, 'user-auth'), { recursive: true });
    await mkdir(join(specsDir, 'payment-flow'), { recursive: true });
    await writeFile(
      join(specsDir, 'user-auth', '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'user-auth',
          title: 'User Auth',
          status: 'created',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(
      join(specsDir, 'payment-flow', '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'payment-flow',
          status: 'spec-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'scifi', 'list']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('user-auth');
    expect(combined).toContain('payment-flow');
  });

  it('filters features by status', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');
    await mkdir(join(specsDir, 'user-auth'), { recursive: true });
    await mkdir(join(specsDir, 'payment-flow'), { recursive: true });
    await writeFile(
      join(specsDir, 'user-auth', '.scifi.json'),
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
    await writeFile(
      join(specsDir, 'payment-flow', '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'payment-flow',
          status: 'spec-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'scifi', 'list', '--status', 'spec-ready']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).not.toContain('user-auth');
    expect(combined).toContain('payment-flow');
  });

  it('shows open fix count for features with fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');
    await mkdir(join(specsDir, 'user-auth'), { recursive: true });
    await writeFile(
      join(specsDir, 'user-auth', '.scifi.json'),
      JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'in-progress',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
      }),
      'utf8',
    );

    const fixesDir = join(specsDir, 'user-auth', 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      '---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n',
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0002-null-pointer.md'),
      '---\nid: FIX-0002\nslug: null-pointer\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# null pointer\n',
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'scifi', 'list']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('user-auth');
    const lineWithFixes = combined.split('\n').find((l) => l.includes('user-auth'));
    expect(lineWithFixes).toBeDefined();
    const fixColumns = lineWithFixes?.split('\t');
    expect(fixColumns[2]).toBe('2 open fixes');
  });

  it('shows dash for features with no open fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');
    await mkdir(join(specsDir, 'user-auth'), { recursive: true });
    await writeFile(
      join(specsDir, 'user-auth', '.scifi.json'),
      JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'in-progress',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
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
      await buildProgram().parseAsync(['node', 'scifi', 'list']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('user-auth');
    const lineNoFixes = combined.split('\n').find((l) => l.includes('user-auth'));
    expect(lineNoFixes).toBeDefined();
    const noFixColumns = lineNoFixes?.split('\t');
    expect(noFixColumns[2]).toBe('-');
  });

  it('discovers features from linked git worktrees', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    const worktreeRoot = join(projectRoot, '.worktrees', 'feat-other');
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

    await execFileAsync('git', ['worktree', 'add', '-b', 'feat/other', worktreeRoot], {
      cwd: projectRoot,
    });

    const worktreeSpecsDir = join(worktreeRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeSpecsDir, { recursive: true });
    await writeFile(
      join(worktreeSpecsDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          slug: 'payment-flow',
          status: 'spec-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'scifi', 'list']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('user-auth');
    expect(combined).toContain('payment-flow');

    const lines = combined.split('\n');
    const userAuthLine = lines.find((l) => l.includes('user-auth'));
    const paymentFlowLine = lines.find((l) => l.includes('payment-flow'));
    expect(userAuthLine).toBeDefined();
    expect(paymentFlowLine).toBeDefined();
    expect(userAuthLine?.split('\t')).toContain('local');
    expect(paymentFlowLine?.split('\t')).toContain(`worktree:${await realpath(worktreeRoot)}`);
    expect(paymentFlowLine?.split('\t')[2]).toBe('-');
  });

  it('succeeds outside a git repository and shows only local features', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await writeFeatureMetadata(projectRoot, 'user-auth', 'created');

    const combined = await captureStdout(['list']);
    expect(combined).toContain('user-auth');
    expect(combined).toContain('local');
    expect(combined).not.toContain('worktree:');
  });

  it('falls back to local-only output when git worktree list fails', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    const fakeBinDir = await mkdtemp(join(tmpdir(), 'scifi-list-fake-bin-'));
    temporaryDirectories.push(projectRoot, fakeBinDir);
    process.chdir(projectRoot);

    await writeFile(
      join(fakeBinDir, 'git'),
      '#!/bin/sh\necho "fake git failure" >&2\nexit 1\n',
      'utf8',
    );
    await execFileAsync('chmod', ['+x', join(fakeBinDir, 'git')]);
    await writeFeatureMetadata(projectRoot, 'user-auth', 'created');

    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBinDir}:${process.env.PATH ?? ''}`;

    let combined: string;
    try {
      combined = await captureStdout(['list']);
    } finally {
      process.env.PATH = previousPath;
    }

    expect(combined).toContain('user-auth');
    expect(combined).toContain('local');
    expect(combined).not.toContain('worktree:');
  });

  it('does not duplicate a local feature when the current checkout is included in git worktree list', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-cmd-'));
    const worktreeRoot = join(projectRoot, '.worktrees', 'feat-other');
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

    await execFileAsync('git', ['worktree', 'add', '-b', 'feat/other', worktreeRoot], {
      cwd: projectRoot,
    });

    const combined = await captureStdout(['list']);
    const lines = combined.split('\n').filter((l) => l.includes('user-auth'));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.split('\t')).toContain('local');
    expect(lines[0]?.split('\t')).not.toContain(`worktree:${await realpath(projectRoot)}`);
  });
});
