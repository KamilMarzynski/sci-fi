import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerSpecReadyCommand(program: Command): void {
  program
    .command("spec-ready")
    .description("Mark a feature as spec-ready (validates spec.md exists)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "spec-ready", createTimestamp());
      process.stdout.write(`feature ${slug} marked as spec-ready\n`);
    });
}
