import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFinishCommand(program: Command): void {
  program
    .command("finish")
    .description("Mark a feature as done (requires all tasks to be done)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "done", createTimestamp());
      process.stdout.write(`feature ${slug} marked as done\n`);
    });
}
