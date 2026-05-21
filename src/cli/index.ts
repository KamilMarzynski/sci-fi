import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { stderr } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerSpecCommand } from "./commands/spec.js";
import { registerPlanReadyCommand } from "./commands/plan-ready.js";
import { registerSpecReadyCommand } from "./commands/spec-ready.js";
import { registerStartCommand } from "./commands/start.js";
import { registerFinishCommand } from "./commands/finish.js";
import { registerListCommand } from "./commands/list.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerBugCommand } from "./commands/bug.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");

function readPackageVersion(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "string"
  ) {
    return value.version;
  }

  throw new Error("Unable to read version from package.json");
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("specflow")
    .description("Specification-driven CLI scaffolding for agentic workflows")
    .version(readPackageVersion(packageJson));

  registerInitCommand(program);
  registerSpecCommand(program);
  registerSpecReadyCommand(program);
  registerPlanReadyCommand(program);
  registerStartCommand(program);
  registerFinishCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);
  registerTaskCommand(program);
  registerBugCommand(program);

  return program;
}

export function isDirectExecution(
  moduleUrl: string,
  argv: readonly string[],
): boolean {
  const scriptPath = argv[1];

  if (scriptPath === undefined) {
    return false;
  }

  return (
    normalizeExecutionPath(fileURLToPath(moduleUrl)) ===
    normalizeExecutionPath(scriptPath)
  );
}

function normalizeExecutionPath(path: string): string {
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    return resolvedPath;
  }

  return realpathSync(resolvedPath);
}

function formatCliError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "specflow failed with an unexpected error.";
}

async function runCli(argv: readonly string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}

if (isDirectExecution(import.meta.url, process.argv)) {
  await runCli(process.argv).catch((error: unknown) => {
    stderr.write(`${formatCliError(error)}\n`);
    process.exitCode =
      process.exitCode === undefined || process.exitCode === 0
        ? 1
        : process.exitCode;
  });
}
