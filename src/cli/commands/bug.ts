import { relative } from 'node:path';
import { cwd } from 'node:process';
import type { Command } from 'commander';
import { createBug } from '../../core/bugs/create.js';
import { BUG_SEVERITY_VALUES, type BugSeverity } from '../../core/bugs/types.js';
import { emitError, emitSuccess, jsonMode, ScifiError } from '../../core/output/index.js';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerBugCommand(program: Command): void {
  program
    .command('bug')
    .description('Create a standalone bug report in the root bugs/ directory')
    .argument('<description>', 'short description of the bug')
    .option('--related-feature <slug>', 'feature slug for context')
    .option('--severity <level>', 'severity level: low, medium, high, or critical')
    .option('--json', 'output as structured JSON')
    .action(
      async (
        description: string,
        options: {
          relatedFeature?: string;
          severity?: string;
          json?: boolean;
        },
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          if (
            options.severity !== undefined &&
            !(BUG_SEVERITY_VALUES as readonly string[]).includes(options.severity)
          ) {
            throw new ScifiError('INVALID_ARGUMENT', `Invalid severity "${options.severity}".`, {
              hint: `Must be one of: ${BUG_SEVERITY_VALUES.join(', ')}.`,
            });
          }
          const severity = options.severity as BugSeverity | undefined;

          const projectRoot = cwd();
          const result = await createBug({
            projectRoot,
            description,
            ...(options.relatedFeature !== undefined && {
              relatedFeature: options.relatedFeature,
            }),
            ...(severity !== undefined && { severity }),
            now: createTimestamp(),
          });

          const path = relative(projectRoot, result.filePath);
          emitSuccess(
            {
              action: 'bug',
              id: result.id,
              description,
              severity: severity ?? null,
              path,
              relatedFeature: options.relatedFeature ?? null,
            },
            json,
            [
              `Bug created: ${result.id}`,
              `  Description: ${description}`,
              `  Severity: ${severity ?? 'unspecified'}`,
              `  Path: ${path}`,
              `  Related feature: ${options.relatedFeature ?? 'none'}`,
            ],
          );
        } catch (error) {
          emitError(error, json);
        }
      },
    );
}
