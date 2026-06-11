import { cwd } from 'node:process';
import type { Command } from 'commander';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';
import { updateFeatureStatus } from '../../core/specs/transition.js';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Mark a feature as in-progress (requires plan-ready status)')
    .argument('<slug>', 'feature folder slug')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const result = await updateFeatureStatus(cwd(), slug, 'in-progress', createTimestamp());
        emitSuccess({ action: 'start', ...result }, json, [
          `feature ${result.slug}: ${result.previousStatus} → ${result.newStatus}`,
          `  Timestamp: ${result.timestamp}`,
        ]);
      } catch (error) {
        emitError(error, json);
      }
    });
}
