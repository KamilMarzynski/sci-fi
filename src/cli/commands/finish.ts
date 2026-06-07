import { Command } from "commander";
import { cwd } from "node:process";
import { listOpenFixes } from "../../core/fixes/list.js";
import {
  SpecflowError,
  emitError,
  emitSuccess,
  jsonMode,
} from "../../core/output/index.js";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFinishCommand(program: Command): void {
  program
    .command("finish")
    .description(
      "Mark a feature as done (requires all tasks done and no open fixes)",
    )
    .argument("<slug>", "feature folder slug")
    .option("--json", "output as structured JSON")
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const projectRoot = cwd();
        const openFixes = await listOpenFixes(projectRoot, slug);

        if (openFixes.length > 0) {
          const ids = openFixes.map((f) => f.id).join(", ");
          throw new SpecflowError(
            "PRECONDITION_FAILED",
            `Cannot finish ${slug}: ${openFixes.length} open fix${openFixes.length === 1 ? "" : "es"} block completion`,
            {
              hint: `Resolve or mark wont-fix the following fixes: ${ids}`,
              details: {
                openFixes: openFixes.map((f) => ({
                  id: f.id,
                  status: f.status,
                  slug: f.slug,
                })),
              },
            },
          );
        }

        const result = await updateFeatureStatus(
          projectRoot,
          slug,
          "done",
          createTimestamp(),
        );
        emitSuccess({ action: "finish", ...result }, json, [
          `feature ${result.slug}: ${result.previousStatus} → ${result.newStatus}`,
          `  ID: ${result.id}`,
          `  Timestamp: ${result.timestamp}`,
        ]);
      } catch (error) {
        emitError(error, json);
      }
    });
}
