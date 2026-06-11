import { cwd } from 'node:process';
import type { Command } from 'commander';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';
import { inspectPlanSession } from '../../core/specs/plan-session.js';

export function registerPlanCommand(program: Command): void {
  program
    .command('plan')
    .description('Open a planning session for a spec-ready feature (reports plan progress)')
    .argument('<slug>', 'feature folder slug')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const session = await inspectPlanSession(cwd(), slug);

        const guidance =
          session.state === 'ready-to-plan'
            ? [
                'No design.md or tasks yet — start the plan from scratch.',
                `Next: write design.md and tasks/, then run \`scifi plan-ready ${session.slug}\`.`,
              ]
            : session.state === 'in-progress'
              ? [
                  'Planning already started but is incomplete.',
                  `  design.md: ${session.designExists ? 'present' : 'missing'}`,
                  `  tasks:     ${session.taskFileCount} file${session.taskFileCount === 1 ? '' : 's'}`,
                  'Continue where it left off, or rewrite from scratch if the approach changed.',
                ]
              : [
                  'This feature is already planned (status is past spec-ready).',
                  `  design.md: ${session.designExists ? 'present' : 'missing'}`,
                  `  tasks:     ${session.taskFileCount} file${session.taskFileCount === 1 ? '' : 's'}`,
                  'Ask the user whether to continue refining the existing plan or start over.',
                ];

        emitSuccess({ action: 'plan', ...session }, json, [
          `feature ${session.slug}: ${session.status} (plan ${session.state})`,
          '',
          ...guidance,
        ]);
      } catch (error) {
        emitError(error, json);
      }
    });
}
