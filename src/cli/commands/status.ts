import { cwd } from 'node:process';
import type { Command } from 'commander';
import { listFixes } from '../../core/fixes/list.js';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';
import { inspectFeatureLifecycle } from '../../core/specs/lifecycle.js';
import { listTasks } from '../../core/tasks/list.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show lifecycle status and artifact inventory for a feature')
    .argument('<slug>', 'feature folder slug')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const lifecycle = await inspectFeatureLifecycle(projectRoot, slug);
        const tasks = await listTasks(projectRoot, slug);
        const fixes = await listFixes(projectRoot, slug);

        const { metadata, artifacts } = lifecycle;

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

        const title = metadata.title !== undefined ? ` (${metadata.title})` : '';
        const humanLines = [
          `slug:    ${metadata.slug}${title}`,
          `id:      ${metadata.id}`,
          `status:  ${metadata.status}`,
          ...(metadata.branch !== undefined ? [`branch:  ${metadata.branch}`] : []),
          ...(metadata.worktreePath !== undefined ? [`worktree: ${metadata.worktreePath}`] : []),
          ``,
          `spec.md:    ${artifacts.specExists ? 'present' : 'missing'}`,
          `design.md:  ${artifacts.designExists ? 'present' : 'missing'}`,
          `tasks:      ${artifacts.taskFileCount} file${artifacts.taskFileCount === 1 ? '' : 's'}`,
          ...(tasks.length > 0
            ? ['', ...tasks.map((task) => `  ${task.slug}\t${task.status}`)]
            : []),
          ...(fixes.length > 0
            ? ['', 'fixes:', ...fixes.map((fix) => `  ${fix.id}  ${fix.status}  ${fix.slug}`)]
            : []),
        ];

        emitSuccess(data, json, humanLines);
      } catch (error) {
        emitError(error, json);
      }
    });
}
