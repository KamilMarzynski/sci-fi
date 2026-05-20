import { Command } from "commander";
import { cwd } from "node:process";
import { inspectFeatureLifecycle } from "../../core/specs/lifecycle.js";
import { listTasks } from "../../core/tasks/list.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show lifecycle status and artifact inventory for a feature")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      const projectRoot = cwd();
      const lifecycle = await inspectFeatureLifecycle(projectRoot, slug);
      const tasks = await listTasks(projectRoot, slug);

      const { metadata, artifacts } = lifecycle;
      const title = metadata.title !== undefined ? ` (${metadata.title})` : "";

      process.stdout.write(`slug:    ${metadata.slug}${title}\n`);
      process.stdout.write(`id:      ${metadata.id}\n`);
      process.stdout.write(`status:  ${metadata.status}\n`);
      process.stdout.write(`\n`);
      process.stdout.write(`spec.md:          ${artifacts.specExists ? "present" : "missing"}\n`);
      process.stdout.write(`architecture.md:  ${artifacts.architectureExists ? "present" : "missing"}\n`);
      process.stdout.write(`tasks:            ${artifacts.taskFileCount} file${artifacts.taskFileCount === 1 ? "" : "s"}\n`);

      if (tasks.length > 0) {
        process.stdout.write(`\n`);
        for (const task of tasks) {
          process.stdout.write(`  ${task.slug}\t${task.status}\n`);
        }
      }
    });
}
