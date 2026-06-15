import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGitWorktreeProvider,
  parseGitWorktreeList,
} from '../../../src/core/specs/worktree-discovery.js';

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

function typicalPorcelain(mainPath: string, linkedPath: string): string {
  return `worktree ${mainPath}\nHEAD 1111111111111111111111111111111111111111\nbranch refs/heads/main\n\nworktree ${linkedPath}\nHEAD 2222222222222222222222222222222222222222\nbranch refs/heads/feat/other\n\n`;
}

describe('parseGitWorktreeList', () => {
  it('parses a typical porcelain block into absolute LinkedWorktree entries', () => {
    const projectRoot = '/project';
    const mainPath = '/project';
    const linkedPath = '/project/.worktrees/feat-other';
    const output = typicalPorcelain(mainPath, linkedPath);

    const worktrees = parseGitWorktreeList(output, projectRoot, mainPath);

    expect(worktrees).toHaveLength(2);
    expect(worktrees[0]).toEqual({ path: mainPath, isCurrent: true });
    expect(worktrees[1]).toEqual({ path: linkedPath, isCurrent: false });
  });

  it('marks the deepest worktree containing cwd as the current checkout', () => {
    const projectRoot = '/project';
    const mainPath = '/project';
    const linkedPath = '/project/.worktrees/feat-other';
    const output = typicalPorcelain(mainPath, linkedPath);

    const worktrees = parseGitWorktreeList(output, projectRoot, linkedPath);

    expect(worktrees).toEqual([
      { path: mainPath, isCurrent: false },
      { path: linkedPath, isCurrent: true },
    ]);
  });

  it('resolves relative worktree paths against the project root', () => {
    const projectRoot = '/project';
    const output = `worktree .\nHEAD abcdef\nbranch refs/heads/main\n\nworktree .worktrees/feat-other\nHEAD fedcba\nbranch refs/heads/feat/other\n\n`;

    const worktrees = parseGitWorktreeList(output, projectRoot, projectRoot);

    expect(worktrees).toEqual([
      { path: '/project', isCurrent: true },
      { path: '/project/.worktrees/feat-other', isCurrent: false },
    ]);
  });

  it('returns an empty array for empty output', () => {
    const worktrees = parseGitWorktreeList('', '/project', '/project');
    expect(worktrees).toEqual([]);
  });

  it('returns an empty array for malformed output without worktree lines', () => {
    const worktrees = parseGitWorktreeList(
      'HEAD abcdef\nbranch refs/heads/main\n\n',
      '/project',
      '/project',
    );
    expect(worktrees).toEqual([]);
  });

  it('skips worktree lines with empty paths', () => {
    const output = `worktree /project\nHEAD abcdef\nbranch refs/heads/main\n\nworktree \nHEAD fedcba\n\n`;
    const worktrees = parseGitWorktreeList(output, '/project', '/project');
    expect(worktrees).toEqual([{ path: '/project', isCurrent: true }]);
  });
});

describe('createGitWorktreeProvider', () => {
  it('returns an empty array when the project root is not a git repository', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-not-git-'));
    temporaryDirectories.push(projectRoot);

    const provider = createGitWorktreeProvider();
    const worktrees = await provider.discover(projectRoot);

    expect(worktrees).toEqual([]);
  });

  it('returns linked worktrees for a real git repository', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-git-'));
    const linkedPath = join(projectRoot, '.worktrees', 'linked');
    temporaryDirectories.push(projectRoot);

    await writeFile(join(projectRoot, 'initial.txt'), 'initial\n', 'utf8');

    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    await execFileAsync('git', ['init'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot });
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: projectRoot });
    await execFileAsync('git', ['worktree', 'add', '-b', 'feat/linked', linkedPath], {
      cwd: projectRoot,
    });

    process.chdir(projectRoot);

    const provider = createGitWorktreeProvider();
    const worktrees = await provider.discover(projectRoot);

    const realProjectRoot = await realpath(projectRoot);
    const realLinkedPath = await realpath(linkedPath);
    const paths = worktrees.map((w) => w.path);
    expect(paths).toContain(realProjectRoot);
    expect(paths).toContain(realLinkedPath);
    expect(worktrees.find((w) => w.path === realProjectRoot)?.isCurrent).toBe(true);
    expect(worktrees.find((w) => w.path === realLinkedPath)?.isCurrent).toBe(false);
  });

  it('skips a linked worktree whose directory has been removed', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-git-'));
    const linkedPath = join(projectRoot, '.worktrees', 'linked');
    temporaryDirectories.push(projectRoot);

    await writeFile(join(projectRoot, 'initial.txt'), 'initial\n', 'utf8');

    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    await execFileAsync('git', ['init'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot });
    await execFileAsync('git', ['add', '.'], { cwd: projectRoot });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: projectRoot });
    await execFileAsync('git', ['worktree', 'add', '-b', 'feat/linked', linkedPath], {
      cwd: projectRoot,
    });

    await rm(linkedPath, { recursive: true, force: true });

    process.chdir(projectRoot);

    const provider = createGitWorktreeProvider();
    const worktrees = await provider.discover(projectRoot);

    const realProjectRoot = await realpath(projectRoot);
    const paths = worktrees.map((w) => w.path);
    expect(paths).toEqual([realProjectRoot]);
  });
});
