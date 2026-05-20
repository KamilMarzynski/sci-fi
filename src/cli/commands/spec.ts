import { Command } from "commander";
import { cwd } from "node:process";
import { createFeature } from "../../core/specs/create.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerSpecCommand(program: Command): void {
  program
    .command("spec")
    .description("Create a specflow-managed feature container")
    .argument("<slug>", "feature folder slug")
    .option("--title <title>", "display title for the feature")
    .action(async (slug: string, options: { title?: string }) => {
      await createFeature({
        projectRoot: cwd(),
        slug,
        ...(options.title !== undefined && { title: options.title }),
        now: createTimestamp(),
      });
    });
}
