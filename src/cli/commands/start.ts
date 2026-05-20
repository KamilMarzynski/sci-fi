import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Mark a feature as in-progress (requires plan-ready status)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "in-progress", createTimestamp());
      process.stdout.write(`feature ${slug} marked as in-progress\n`);
    });
}
