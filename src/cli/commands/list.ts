import { Command } from "commander";
import { cwd } from "node:process";
import { listOpenFixes } from "../../core/fixes/list.js";
import { listFeatures } from "../../core/specs/list.js";
import type { FeatureStatus } from "../../core/specs/types.js";
import { FEATURE_STATUS_VALUES } from "../../core/specs/types.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List all features")
    .option("--status <status>", "filter by lifecycle status")
    .action(async (options: { status?: string }) => {
      const statusFilter =
        options.status !== undefined &&
        (FEATURE_STATUS_VALUES as readonly string[]).includes(options.status)
          ? (options.status as FeatureStatus)
          : undefined;

      const listOptions = { projectRoot: cwd() };
      if (statusFilter !== undefined) {
        (listOptions as { status?: FeatureStatus }).status = statusFilter;
      }
      const features = await listFeatures(listOptions);

      for (const feature of features) {
        const title = feature.title ?? "";
        const openFixes = await listOpenFixes(cwd(), feature.slug);
        const fixesLabel =
          openFixes.length > 0
            ? `${openFixes.length} open fix${openFixes.length === 1 ? "" : "es"}`
            : "-";
        process.stdout.write(
          `${feature.id}\t${feature.slug}\t${feature.status}\t${fixesLabel}\t${title}\n`,
        );
      }
    });
}
