import { Command } from "commander";
import { cwd } from "node:process";
import { emitError, emitSuccess, jsonMode } from "../../core/output/index.js";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerSpecReadyCommand(program: Command): void {
  program
    .command("spec-ready")
    .description("Mark a feature as spec-ready (validates spec.md exists)")
    .argument("<slug>", "feature folder slug")
    .option("--json", "output as structured JSON")
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const result = await updateFeatureStatus(
          cwd(),
          slug,
          "spec-ready",
          createTimestamp(),
        );
        emitSuccess({ action: "spec-ready", ...result }, json, [
          `feature ${result.slug}: ${result.previousStatus} → ${result.newStatus}`,
          `  ID: ${result.id}`,
          `  Timestamp: ${result.timestamp}`,
        ]);
      } catch (error) {
        emitError(error, json);
      }
    });
}
