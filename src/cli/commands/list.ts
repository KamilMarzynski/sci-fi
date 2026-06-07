import { cwd } from 'node:process';
import type { Command } from 'commander';
import { listOpenFixes } from '../../core/fixes/list.js';
import { emitError, emitList, jsonMode } from '../../core/output/index.js';
import { listFeatures } from '../../core/specs/list.js';
import type { FeatureStatus } from '../../core/specs/types.js';
import { FEATURE_STATUS_VALUES } from '../../core/specs/types.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all features')
    .option('--status <status>', 'filter by lifecycle status')
    .option('--json', 'output as structured JSON (NDJSON)')
    .action(async (options: { status?: string; json?: boolean }, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const statusFilter =
          options.status !== undefined &&
          (FEATURE_STATUS_VALUES as readonly string[]).includes(options.status)
            ? (options.status as FeatureStatus)
            : undefined;

        const listOptions = { projectRoot };
        if (statusFilter !== undefined) {
          (listOptions as { status?: FeatureStatus }).status = statusFilter;
        }
        const features = await listFeatures(listOptions);

        const rows = await Promise.all(
          features.map(async (feature) => {
            const openFixes = await listOpenFixes(projectRoot, feature.slug);
            return {
              id: feature.id,
              slug: feature.slug,
              status: feature.status,
              openFixes: openFixes.length,
              title: feature.title ?? '',
            };
          }),
        );

        const humanLines = [
          ['ID', 'SLUG', 'STATUS', 'OPEN FIXES', 'TITLE'].join('\t'),
          ...rows.map((row) =>
            [
              row.id,
              row.slug,
              row.status,
              row.openFixes > 0
                ? `${row.openFixes} open fix${row.openFixes === 1 ? '' : 'es'}`
                : '-',
              row.title,
            ].join('\t'),
          ),
        ];

        emitList(rows, json, humanLines);
      } catch (error) {
        emitError(error, json);
      }
    });
}
