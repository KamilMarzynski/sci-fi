import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface LinkedWorktree {
  path: string;
  isCurrent: boolean;
}

export interface WorktreeProvider {
  discover(projectRoot: string): Promise<LinkedWorktree[]>;
}

function isAncestorOrSame(parent: string, child: string): boolean {
  if (parent === child) return true;
  const separator = parent.endsWith('/') ? '' : '/';
  return child.startsWith(`${parent}${separator}`);
}

export function parseGitWorktreeList(
  output: string,
  projectRoot: string,
  currentWorkingDirectory: string,
): LinkedWorktree[] {
  const lines = output.split('\n');
  const worktrees: LinkedWorktree[] = [];

  for (const line of lines) {
    if (!line.startsWith('worktree ')) continue;

    const rawPath = line.slice('worktree '.length).trim();
    if (rawPath.length === 0) continue;

    const absolutePath = resolve(projectRoot, rawPath);
    worktrees.push({
      path: absolutePath,
      isCurrent: isAncestorOrSame(absolutePath, currentWorkingDirectory),
    });
  }

  return worktrees;
}

export function createGitWorktreeProvider(): WorktreeProvider {
  return {
    async discover(projectRoot: string): Promise<LinkedWorktree[]> {
      try {
        const resolvedRoot = await realpath(projectRoot);
        const currentWorkingDirectory = await realpath(process.cwd());
        const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
          cwd: resolvedRoot,
        });
        const parsed = parseGitWorktreeList(stdout, resolvedRoot, currentWorkingDirectory);
        return await Promise.all(
          parsed.map(async (worktree) => ({
            path: await realpath(worktree.path),
            isCurrent: worktree.isCurrent,
          })),
        );
      } catch {
        return [];
      }
    },
  };
}
