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
  const candidates: LinkedWorktree[] = [];

  for (const line of lines) {
    if (!line.startsWith('worktree ')) continue;

    const rawPath = line.slice('worktree '.length).trim();
    if (rawPath.length === 0) continue;

    const absolutePath = resolve(projectRoot, rawPath);
    candidates.push({
      path: absolutePath,
      isCurrent: isAncestorOrSame(absolutePath, currentWorkingDirectory),
    });
  }

  const currentCandidates = candidates.filter((worktree) => worktree.isCurrent);
  if (currentCandidates.length > 1) {
    const deepest = currentCandidates.reduce((longest, worktree) =>
      worktree.path.length > longest.path.length ? worktree : longest,
    );
    for (const worktree of candidates) {
      worktree.isCurrent = worktree.path === deepest.path;
    }
  }

  return candidates;
}

async function safeRealpath(inputPath: string): Promise<string | undefined> {
  try {
    return await realpath(inputPath);
  } catch {
    return undefined;
  }
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
        const normalized = await Promise.all(
          parsed.map(async (worktree) => {
            const normalizedPath = await safeRealpath(worktree.path);
            if (normalizedPath === undefined) return undefined;
            return {
              path: normalizedPath,
              isCurrent: worktree.isCurrent,
            };
          }),
        );
        return normalized.filter((worktree): worktree is LinkedWorktree => worktree !== undefined);
      } catch {
        return [];
      }
    },
  };
}
