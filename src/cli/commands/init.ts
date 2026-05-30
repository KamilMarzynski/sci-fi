import { cwd, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { scaffoldInit } from "../../core/init/scaffold.js";
import { resolveHarness } from "../../core/init/prompt-harness.js";
import { installSkills } from "../../core/init/install-skills.js";
import { writeConfig } from "../../core/init/config.js";
import { findPackageRoot } from "../../core/package-root.js";
import type { HarnessId } from "../../core/skills/harness/adapter.js";
import { getAdapter } from "../../core/skills/harness/registry.js";

interface InitCommandOptions {
  readonly harness?: string;
  readonly yes?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize specflow in the current repository")
    .option("--harness <id>", "harness adapter to install skills for")
    .option("--yes", "skip prompts and use defaults")
    .action(async (options: InitCommandOptions) => {
      const projectRoot = cwd();
      const packageRoot = findPackageRoot(import.meta.url);
      const harness = await resolveHarness({
        flag: options.harness,
        yes: options.yes === true,
        ask: askInteractively,
      });

      // Validate the adapter is implemented before touching the filesystem.
      getAdapter(harness);

      await scaffoldInit({ projectRoot, harness });
      await installSkills({ projectRoot, harness, packageRoot });
      await writeConfig({ projectRoot, harness });
    });
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

