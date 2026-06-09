import { cwd } from 'node:process';
import type { Command } from 'commander';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';
import { updateFeatureStatus } from '../../core/specs/transition.js';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerPlanReadyCommand(program: Command): void {
  program
    .command('plan-ready')
    .description('Mark a feature as plan-ready (validates design.md and tasks/ exist)')
    .argument('<slug>', 'feature folder slug')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const result = await updateFeatureStatus(cwd(), slug, 'plan-ready', createTimestamp());
        emitSuccess({ action: 'plan-ready', ...result }, json, [
          `feature ${result.slug}: ${result.previousStatus} → ${result.newStatus}`,
          `  ID: ${result.id}`,
          `  Timestamp: ${result.timestamp}`,
        ]);
      } catch (error) {
        emitError(error, json);
      }
    });
}
