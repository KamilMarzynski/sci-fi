import { Command } from "commander";
import { cwd } from "node:process";
import { createFix } from "../../core/fixes/create.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description(
      "Create a fix inside a feature's fixes/ directory (blocks finish until resolved)",
    )
    .argument("<description>", "short description of the fix")
    .requiredOption("--feature <slug>", "feature slug to attach this fix to")
    .action(async (description: string, options: { feature: string }) => {
      const result = await createFix({
        projectRoot: cwd(),
        description,
        featureSlug: options.feature,
        now: createTimestamp(),
      });

      process.stdout.write(`${result.id}  ${result.filePath}\n`);
    });
}
