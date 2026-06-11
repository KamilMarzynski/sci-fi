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
