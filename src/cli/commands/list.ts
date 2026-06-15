import { cwd } from 'node:process';
import type { Command } from 'commander';
import { listOpenFixes } from '../../core/fixes/list.js';
import { emitError, emitList, jsonMode } from '../../core/output/index.js';
import { listFeatures } from '../../core/specs/list.js';
import type { FeatureStatus } from '../../core/specs/types.js';
import { FEATURE_STATUS_VALUES } from '../../core/specs/types.js';
import { createGitWorktreeProvider } from '../../core/specs/worktree-discovery.js';

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

        const listOptions = { projectRoot, worktreeProvider: createGitWorktreeProvider() };
        if (statusFilter !== undefined) {
          (listOptions as { status?: FeatureStatus }).status = statusFilter;
        }
        const features = await listFeatures(listOptions);

        const rows = await Promise.all(
          features.map(async (feature) => {
            const openFixes =
              feature.location === 'local'
                ? await listOpenFixes(projectRoot, feature.metadata.slug)
                : [];
            return {
              slug: feature.metadata.slug,
              status: feature.metadata.status,
              openFixes: openFixes.length,
              title: feature.metadata.title ?? '',
              location: feature.location,
            };
          }),
        );

        const humanLines = [
          ['SLUG', 'STATUS', 'OPEN FIXES', 'LOCATION', 'TITLE'].join('\t'),
          ...rows.map((row) =>
            [
              row.slug,
              row.status,
              row.openFixes > 0
                ? `${row.openFixes} open fix${row.openFixes === 1 ? '' : 'es'}`
                : '-',
              row.location,
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
