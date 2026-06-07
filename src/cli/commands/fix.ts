import { Command } from "commander";
import { cwd } from "node:process";
import { relative } from "node:path";
import { createFix } from "../../core/fixes/create.js";
import { emitError, emitSuccess, jsonMode } from "../../core/output/index.js";

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
    .option("--json", "output as structured JSON")
    .action(
      async (
        description: string,
        options: { feature: string; json?: boolean },
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          const projectRoot = cwd();
          const result = await createFix({
            projectRoot,
            description,
            featureSlug: options.feature,
            now: createTimestamp(),
          });

          const path = relative(projectRoot, result.filePath);
          emitSuccess(
            {
              action: "fix",
              id: result.id,
              description,
              feature: options.feature,
              path,
            },
            json,
            [
              `Fix created: ${result.id}`,
              `  Description: ${description}`,
              `  Feature: ${options.feature}`,
              `  Path: ${path}`,
            ],
          );
        } catch (error) {
          emitError(error, json);
        }
      },
    );
}
