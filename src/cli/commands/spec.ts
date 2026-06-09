import { relative } from 'node:path';
import { cwd } from 'node:process';
import type { Command } from 'commander';
import { emitError, emitSuccess, jsonMode } from '../../core/output/index.js';
import { createFeature } from '../../core/specs/create.js';

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerSpecCommand(program: Command): void {
  program
    .command('spec')
    .description('Create a scifi-managed feature container')
    .argument('<slug>', 'feature folder slug')
    .option('--title <title>', 'display title for the feature')
    .option('--json', 'output as structured JSON')
    .action(async (slug: string, options: { title?: string; json?: boolean }, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const result = await createFeature({
          projectRoot,
          slug,
          ...(options.title !== undefined && { title: options.title }),
          now: createTimestamp(),
        });

        const path = relative(projectRoot, result.featureDirectoryPath);
        const metadataPath = relative(projectRoot, result.metadataPath);

        emitSuccess(
          {
            action: 'spec',
            slug,
            id: result.id,
            path,
            status: 'created',
            metadataPath,
          },
          json,
          [
            `Feature created: ${slug}`,
            `  ID:     ${result.id}`,
            `  Path:   ${path}`,
            `  Status: created`,
            ``,
            `Next: write spec.md, then run \`scifi spec-ready ${slug}\``,
          ],
        );
      } catch (error) {
        emitError(error, json);
      }
    });
}
