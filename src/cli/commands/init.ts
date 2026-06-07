import { cwd, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { scaffoldInit } from "../../core/init/scaffold.js";
import { resolveHarness } from "../../core/init/prompt-harness.js";
import { installSkills } from "../../core/init/install-skills.js";
import { writeConfig } from "../../core/init/config.js";
import {
  SpecflowError,
  emitError,
  emitSuccess,
  isInteractive,
  jsonMode,
} from "../../core/output/index.js";
import { findPackageRoot } from "../../core/package-root.js";
import {
  HarnessNotImplementedError,
  InvalidHarnessError,
  KNOWN_HARNESS_IDS,
  type HarnessId,
} from "../../core/skills/harness/adapter.js";
import { getAdapter } from "../../core/skills/harness/registry.js";

interface InitCommandOptions {
  readonly harness?: string;
  readonly yes?: boolean;
  readonly json?: boolean;
}

const BOOTSTRAP_FILES = [
  "EVALUATION.md",
  "ROADMAP.md",
  "ARCHITECTURE.md",
  "CONTEXT.md",
];

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize specflow in the current repository")
    .option("--harness <id>", "harness adapter to install skills for")
    .option("--yes", "skip prompts and use defaults")
    .option("--json", "output as structured JSON")
    .action(async (options: InitCommandOptions, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const packageRoot = findPackageRoot(import.meta.url);

        if (
          options.harness === undefined &&
          options.yes !== true &&
          !isInteractive()
        ) {
          throw new SpecflowError(
            "INVALID_ARGUMENT",
            "harness selection requires --harness <id> when running non-interactively.",
            { hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(", ")}.` },
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
            action: "init",
            root: "docs/specflow",
            harness,
            files: BOOTSTRAP_FILES,
            skills,
          },
          json,
          [
            `specflow initialized successfully.`,
            `  Root:    docs/specflow`,
            `  Harness: ${harness}`,
            `  Files:   ${BOOTSTRAP_FILES.join(", ")}`,
            `  Skills:  ${skills.join(", ")}`,
            ``,
            `Next: read docs/specflow/CONTEXT.md and docs/specflow/ARCHITECTURE.md,`,
            `then create a spec with \`specflow spec <slug> --title "Your Feature"\``,
          ],
        );
      } catch (error) {
        emitError(normalizeInitError(error), json);
      }
    });
}

function normalizeInitError(error: unknown): unknown {
  if (
    error instanceof InvalidHarnessError ||
    error instanceof HarnessNotImplementedError
  ) {
    return new SpecflowError("INVALID_ARGUMENT", error.message, {
      hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(", ")}.`,
      cause: error,
    });
  }
  return error;
}

async function askInteractively(
  choices: readonly HarnessId[],
): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const numbered = choices
      .map((id, index) => `  ${index + 1}) ${id}`)
      .join("\n");
    const prompt = `Pick a harness:\n${numbered}\nEnter number (default 1): `;
    const answer = (await rl.question(prompt)).trim();

    if (answer === "") {
      const first = choices[0];
      if (first === undefined) {
        throw new Error("No harness choices available");
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
