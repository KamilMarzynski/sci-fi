import { relative } from 'node:path';
import { cwd } from 'node:process';
import type { Command } from 'commander';
import { createFix } from '../../core/fixes/create.js';
import { updateFixStatus } from '../../core/fixes/transition.js';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFixCommand(program: Command): void {
  const fix = program.command('fix').description('Manage fixes within a feature');

  fix
    .command('create')
    .description("Create a fix inside a feature's fixes/ directory (blocks finish until resolved)")
    .argument('<description>', 'short description of the fix')
    .requiredOption('--feature <slug>', 'feature slug to attach this fix to')
    .option('--json', 'output as structured JSON')
    .action(
      async (
        description: string,
        options: { feature: string; json?: boolean },
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          const projectRoot = cwd();
          const result = await createFix({
            projectRoot,
            description,
            featureSlug: options.feature,
            now: createTimestamp(),
          });

          const path = relative(projectRoot, result.filePath);
          emitSuccess(
            { action: 'fix-create', id: result.id, description, feature: options.feature, path },
            json,
            [
              `Fix created: ${result.id}`,
              `  Description: ${description}`,
              `  Feature: ${options.feature}`,
              `  Path: ${path}`,
            ],
          );
        } catch (error) {
          emitError(error, json);
        }
      },
    );

  registerTransitionSubcommand(fix, 'resolve', 'resolved', 'Mark a fix as resolved');
  registerTransitionSubcommand(fix, 'wont-fix', 'wont-fix', 'Mark a fix as wont-fix');
}

function registerTransitionSubcommand(
  fix: Command,
  name: string,
  targetStatus: 'resolved' | 'wont-fix',
  description: string,
): void {
  fix
    .command(name)
    .description(description)
    .argument('<slug>', 'feature folder slug')
    .argument('<id>', 'fix id (e.g. FIX-0001)')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, id: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const result = await updateFixStatus(cwd(), slug, id, targetStatus);
        emitSuccess(
          { action: `fix-${name}`, ...result },
          json,
          `fix ${result.id} (feature: ${result.featureSlug}): ${result.previousStatus} → ${result.newStatus}`,
        );
      } catch (error) {
        emitError(error, json);
      }
    });
}
