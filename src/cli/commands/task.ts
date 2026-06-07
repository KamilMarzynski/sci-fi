import { Command } from "commander";
import { cwd } from "node:process";
import { listTasks } from "../../core/tasks/list.js";
import { updateTaskStatus } from "../../core/tasks/transition.js";

export function registerTaskCommand(program: Command): void {
  const task = program
    .command("task")
    .description("Manage tasks within a feature");

  task
    .command("list")
    .description("List all tasks for a feature with their status")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      const tasks = await listTasks(cwd(), slug);
      for (const t of tasks) {
        process.stdout.write(`${t.slug}\t${t.status}\tdepends-on=${t.dependsOn.join(",")}\n`);
      }
    });

  task
    .command("start")
    .description("Mark a task as in-progress")
    .argument("<slug>", "feature folder slug")
    .argument("<task>", "task slug")
    .action(async (slug: string, taskSlug: string) => {
      await updateTaskStatus(cwd(), slug, taskSlug, "in-progress");
      process.stdout.write(`task ${taskSlug} marked as in-progress\n`);
    });

  task
    .command("done")
    .description("Mark a task as done (requires task to be in-progress)")
    .argument("<slug>", "feature folder slug")
    .argument("<task>", "task slug")
    .action(async (slug: string, taskSlug: string) => {
      await updateTaskStatus(cwd(), slug, taskSlug, "done");
      process.stdout.write(`task ${taskSlug} marked as done\n`);
    });
}
