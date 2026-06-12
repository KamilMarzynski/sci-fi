import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';
import { ScifiError } from '../core/output/errors.js';
import { emitError } from '../core/output/index.js';
import { findPackageRoot } from '../core/package-root.js';
import { readPackageVersion } from '../core/package-version.js';
import { registerFinishCommand } from './commands/finish.js';
import { registerFixCommand } from './commands/fix.js';
import { registerInitCommand } from './commands/init.js';
import { registerListCommand } from './commands/list.js';
import { registerPlanCommand } from './commands/plan.js';
import { registerPlanReadyCommand } from './commands/plan-ready.js';
import { registerSpecCommand } from './commands/spec.js';
import { registerSpecReadyCommand } from './commands/spec-ready.js';
import { registerStartCommand } from './commands/start.js';
import { registerStatusCommand } from './commands/status.js';
import { registerTaskCommand } from './commands/task.js';
import { registerWorktreeCommand } from './commands/worktree.js';

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('scifi')
    .description('Specification-driven CLI scaffolding for agentic workflows')
    .version(readPackageVersion(findPackageRoot(import.meta.url)))
    .exitOverride();

  registerInitCommand(program);
  registerSpecCommand(program);
  registerSpecReadyCommand(program);
  registerPlanCommand(program);
  registerPlanReadyCommand(program);
  registerStartCommand(program);
  registerFinishCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);
  registerTaskCommand(program);
  registerFixCommand(program);
  registerWorktreeCommand(program);

  applyExitOverride(program);

  return program;
}

function applyExitOverride(command: Command): void {
  // Suppress Commander's own "error: ..." line so usage failures surface only
  // through the structured emitError output (avoids double-printing).
  command.configureOutput({ writeErr: () => {} });
  for (const child of command.commands) {
    child.exitOverride();
    applyExitOverride(child);
  }
}

export function isDirectExecution(moduleUrl: string, argv: readonly string[]): boolean {
  const scriptPath = argv[1];

  if (scriptPath === undefined) {
    return false;
  }

  return normalizeExecutionPath(fileURLToPath(moduleUrl)) === normalizeExecutionPath(scriptPath);
}

function normalizeExecutionPath(path: string): string {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    return resolvedPath;
  }

  return realpathSync(resolvedPath);
}

function handleCliError(error: unknown, argv: readonly string[]): void {
  const json = argv.includes('--json');

  if (error instanceof CommanderError) {
    // Help/version requests exit cleanly; Commander already wrote output.
    if (error.exitCode === 0) {
      process.exitCode = 0;
      return;
    }

    const message = error.message.replace(/^error:\s*/i, '');
    emitError(
      new ScifiError('INVALID_ARGUMENT', message, {
        hint: 'Run `scifi --help` (or `<command> --help`) for usage.',
        cause: error,
      }),
      json,
    );
    return;
  }

  emitError(error, json);
}

async function runCli(argv: readonly string[]): Promise<void> {
  try {
    await buildProgram().parseAsync(argv as string[]);
  } catch (error) {
    handleCliError(error, argv);
  }
}

if (isDirectExecution(import.meta.url, process.argv)) {
  await runCli(process.argv);
}
