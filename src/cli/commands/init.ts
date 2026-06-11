import { cwd, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
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
import {
  type HarnessId,
  InvalidHarnessError,
  KNOWN_HARNESS_IDS,
} from '../../core/skills/harness/adapter.js';

interface InitCommandOptions {
  readonly harness: string[];
  readonly yes?: boolean;
  readonly json?: boolean;
}

const BOOTSTRAP_FILES = ['CONTEXT.md'];

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize scifi in the current repository')
    .option(
      '--harness <id>',
      'harness adapter to install skills for (repeatable)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option('--yes', 'skip prompts and use defaults')
    .option('--json', 'output as structured JSON')
    .action(async (options: InitCommandOptions, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const packageRoot = findPackageRoot(import.meta.url);

        if (options.harness.length === 0 && options.yes !== true && !isInteractive()) {
          throw new ScifiError(
            'INVALID_ARGUMENT',
            'harness selection requires --harness <id> when running non-interactively.',
            { hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.` },
          );
        }

        const harnesses = await resolveHarnesses({
          flags: options.harness,
          yes: options.yes === true,
          ask: askInteractively,
        });

        await scaffoldInit({ projectRoot });
        const report = await installSkills({ projectRoot, harnesses, packageRoot });

        if (report.installed.length === 0) {
          const errorDetails = report.failed.map((f) => `${f.harness}: ${f.error.message}`);
          throw new ScifiError(
            'INTERNAL',
            `All selected harnesses failed to install: ${errorDetails.join('; ')}`,
          );
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

function normalizeInitError(error: unknown): unknown {
  if (error instanceof InvalidHarnessError) {
    return new ScifiError('INVALID_ARGUMENT', error.message, {
      hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.`,
      cause: error,
    });
  }
  return error;
}

async function askInteractively(choices: readonly HarnessId[]): Promise<readonly string[]> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const numbered = choices.map((id, index) => `  ${index + 1}) ${id}`).join('\n');
    const prompt = `Pick harnesses (multiple selections allowed — enter numbers separated by space/comma, default 1):\n${numbered}\nEnter numbers: `;

    while (true) {
      const answer = (await rl.question(prompt)).trim();

      if (answer === '') {
        const first = choices[0];
        if (first === undefined) {
          throw new Error('No harness choices available');
        }
        return [first];
      }

      const tokens = answer.split(/[\s,]+/).filter((t) => t.length > 0);
      const selected = tokens.map((token) => {
        const index = Number.parseInt(token, 10) - 1;
        const picked = choices[index];
        return picked !== undefined ? picked : token;
      });

      if (selected.length > 0) {
        return selected;
      }

      stdout.write('Please select at least one harness.\n');
    }
  } finally {
    rl.close();
  }
}
