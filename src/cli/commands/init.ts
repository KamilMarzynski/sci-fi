import { cwd, stdin } from 'node:process';
import type { Command } from 'commander';
import { writeConfig } from '../../core/init/config.js';
import { installSkills } from '../../core/init/install-skills.js';
import { resolveHarnesses } from '../../core/init/prompt-harness.js';
import { scaffoldInit } from '../../core/init/scaffold.js';
import {
  emitError,
  emitSuccess,
  isInteractive,
  jsonMode,
  ScifiError,
} from '../../core/output/index.js';
import { findPackageRoot } from '../../core/package-root.js';
import { InvalidHarnessError, KNOWN_HARNESS_IDS } from '../../core/skills/harness/adapter.js';
import { CheckboxCancelledError, canEnterRawMode, promptHarnesses } from '../prompts/checkbox.js';

interface InitCommandOptions {
  readonly harness: string[];
  readonly yes?: boolean;
  readonly json?: boolean;
}

const BOOTSTRAP_FILES = ['CONTEXT.md'];
const NO_HARNESS_FLAGS: string[] = [];

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize scifi in the current repository')
    .option(
      '--harness <id>',
      'harness adapter to install skills for (repeatable)',
      (value: string, previous: string[]): string[] => [...previous, value],
      NO_HARNESS_FLAGS,
    )
    .option('--yes', 'skip prompts (requires --harness)')
    .option('--json', 'output as structured JSON')
    .action(async (options: InitCommandOptions, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const packageRoot = findPackageRoot(import.meta.url);

        if (options.harness.length === 0 && options.yes !== true) {
          if (!isInteractive()) {
            throw new ScifiError(
              'INVALID_ARGUMENT',
              'harness selection requires --harness <id> when running non-interactively.',
              { hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.` },
            );
          }

          if (!canEnterRawMode(stdin)) {
            throw new ScifiError(
              'INVALID_ARGUMENT',
              'harness selection requires an interactive terminal that supports raw mode.',
              {
                hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}. Pass --harness <id> to select without the prompt.`,
              },
            );
          }
        }

        const harnesses = await resolveHarnesses({
          flags: options.harness,
          yes: options.yes === true,
          ask: promptHarnesses,
        });

        await scaffoldInit({ projectRoot });
        const report = await installSkills({ projectRoot, harnesses, packageRoot });

        if (report.installed.length === 0) {
          const errorDetails = report.failed.map((f) => `${f.harness}: ${f.error.message}`);
          emitError(
            new ScifiError(
              'INTERNAL',
              `All selected harnesses failed to install: ${errorDetails.join('; ')}`,
            ),
            json,
          );
          return;
        }

        await writeConfig({ projectRoot, harnesses: report.installed.map((e) => e.harness) });

        const failedSummary =
          report.failed.length > 0
            ? report.failed.map((f) => `  Failed:  ${f.harness} (${f.error.message})`)
            : [];

        const installedLines = report.installed.flatMap((entry) => [
          `  Harness: ${entry.harness}`,
          `  Location: ${entry.baseDir}`,
          `  Skills: ${entry.skills.join(', ')}`,
        ]);

        emitSuccess(
          {
            action: 'init',
            root: 'docs/scifi',
            harnesses: report.installed,
            files: BOOTSTRAP_FILES,
            ...(report.failed.length > 0 && {
              failed: report.failed.map((f) => ({ harness: f.harness, error: f.error.message })),
            }),
          },
          json,
          [
            `scifi initialized successfully.`,
            `  Root:    docs/scifi`,
            `  Files:   ${BOOTSTRAP_FILES.join(', ')}`,
            ...installedLines,
            ...failedSummary,
            ``,
            `Next: read docs/scifi/CONTEXT.md,`,
            `then create a spec with \`scifi spec <slug> --title "Your Feature"\``,
          ],
        );
      } catch (error) {
        emitError(normalizeInitError(error), json);
      }
    });
}

export function normalizeInitError(error: unknown): unknown {
  if (error instanceof InvalidHarnessError) {
    return new ScifiError('INVALID_ARGUMENT', error.message, {
      hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.`,
      cause: error,
    });
  }

  if (error instanceof CheckboxCancelledError) {
    return new ScifiError('CANCELLED', 'Harness selection cancelled.');
  }

  return error;
}
