import { Command } from "commander";
import { cwd } from "node:process";
import { listOpenFixes } from "../../core/fixes/list.js";
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
    .action(async (slug: string) => {
      const projectRoot = cwd();
      const openFixes = await listOpenFixes(projectRoot, slug);

      if (openFixes.length > 0) {
        const fixLines = openFixes
          .map((f) => `  ${f.id}  ${f.status}  ${f.slug}`)
          .join("\n");
        throw new Error(
          `Cannot finish ${slug}: ${openFixes.length} open fix${openFixes.length === 1 ? "" : "es"}\n\n${fixLines}\n\nResolve or mark wont-fix before finishing.`,
        );
      }

      await updateFeatureStatus(projectRoot, slug, "done", createTimestamp());
      process.stdout.write(`feature ${slug} marked as done\n`);
    });
}
