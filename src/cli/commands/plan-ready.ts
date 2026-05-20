import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerPlanReadyCommand(program: Command): void {
  program
    .command("plan-ready")
    .description("Mark a feature as plan-ready (validates architecture.md and tasks/ exist)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "plan-ready", createTimestamp());
      process.stdout.write(`feature ${slug} marked as plan-ready\n`);
    });
}
