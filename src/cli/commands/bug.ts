import { Command } from "commander";
import { cwd } from "node:process";
import { createBug } from "../../core/bugs/create.js";
import {
  BUG_SEVERITY_VALUES,
  type BugSeverity,
} from "../../core/bugs/types.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerBugCommand(program: Command): void {
  program
    .command("bug")
    .description("Create a standalone bug report in the root bugs/ directory")
    .argument("<description>", "short description of the bug")
    .option("--related-feature <slug>", "feature slug for context")
    .option(
      "--severity <level>",
      "severity level: low, medium, high, or critical",
    )
    .action(
      async (
        description: string,
        options: { relatedFeature?: string; severity?: string },
      ) => {
        if (
          options.severity !== undefined &&
          !(BUG_SEVERITY_VALUES as readonly string[]).includes(options.severity)
        ) {
          throw new Error(
            `Invalid severity "${options.severity}". Must be one of: ${BUG_SEVERITY_VALUES.join(", ")}`,
          );
        }
        const severity = options.severity as BugSeverity | undefined;

        const result = await createBug({
          projectRoot: cwd(),
          description,
          ...(options.relatedFeature !== undefined && {
            relatedFeature: options.relatedFeature,
          }),
          ...(severity !== undefined && { severity }),
          now: createTimestamp(),
        });

        process.stdout.write(`${result.id}  ${result.filePath}\n`);
      },
    );
}
