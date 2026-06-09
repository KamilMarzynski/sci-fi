import { cwd, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { writeConfig } from '../../core/init/config.js';
import { installSkills } from '../../core/init/install-skills.js';
import { resolveHarness } from '../../core/init/prompt-harness.js';
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
  HarnessNotImplementedError,
  InvalidHarnessError,
  KNOWN_HARNESS_IDS,
} from '../../core/skills/harness/adapter.js';
import { getAdapter } from '../../core/skills/harness/registry.js';

interface InitCommandOptions {
  readonly harness?: string;
  readonly yes?: boolean;
  readonly json?: boolean;
}

const BOOTSTRAP_FILES = ['EVALUATION.md', 'CONTEXT.md'];

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize scifi in the current repository')
    .option('--harness <id>', 'harness adapter to install skills for')
    .option('--yes', 'skip prompts and use defaults')
    .option('--json', 'output as structured JSON')
    .action(async (options: InitCommandOptions, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const packageRoot = findPackageRoot(import.meta.url);

        if (options.harness === undefined && options.yes !== true && !isInteractive()) {
          throw new ScifiError(
            'INVALID_ARGUMENT',
            'harness selection requires --harness <id> when running non-interactively.',
            { hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.` },
          );
        }

        const harness = await resolveHarness({
          flag: options.harness,
          yes: options.yes === true,
          ask: askInteractively,
        });

        // Validate the adapter is implemented before touching the filesystem.
        getAdapter(harness);

        await scaffoldInit({ projectRoot, harness });
        const skills = await installSkills({ projectRoot, harness, packageRoot });
        await writeConfig({ projectRoot, harness });

        emitSuccess(
          {
            action: 'init',
            root: 'docs/scifi',
            harness,
            files: BOOTSTRAP_FILES,
            skills,
          },
          json,
          [
            `scifi initialized successfully.`,
            `  Root:    docs/scifi`,
            `  Harness: ${harness}`,
            `  Files:   ${BOOTSTRAP_FILES.join(', ')}`,
            `  Skills:  ${skills.join(', ')}`,
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
  if (error instanceof InvalidHarnessError || error instanceof HarnessNotImplementedError) {
    return new ScifiError('INVALID_ARGUMENT', error.message, {
      hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.`,
      cause: error,
    });
  }
  return error;
}

async function askInteractively(choices: readonly HarnessId[]): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const numbered = choices.map((id, index) => `  ${index + 1}) ${id}`).join('\n');
    const prompt = `Pick a harness:\n${numbered}\nEnter number (default 1): `;
    const answer = (await rl.question(prompt)).trim();

    if (answer === '') {
      const first = choices[0];
      if (first === undefined) {
        throw new Error('No harness choices available');
      }
      return first;
    }

    const index = Number.parseInt(answer, 10) - 1;
    const picked = choices[index];

    if (picked === undefined) {
      return answer;
    }

    return picked;
  } finally {
    rl.close();
  }
}
