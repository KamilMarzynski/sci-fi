import { Command } from "commander";
import { cwd } from "node:process";
import { emitError, emitList, emitSuccess, jsonMode } from "../../core/output/index.js";
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
    .option("--json", "output as structured JSON (NDJSON)")
    .action(async (slug: string, _options: unknown, command: Command) => {
      const json = jsonMode(command);
      try {
        const tasks = await listTasks(cwd(), slug);
        const rows = tasks.map((t) => ({
          slug: t.slug,
          status: t.status,
          dependsOn: t.dependsOn,
        }));
        const humanLines = [
          ["TASK", "STATUS", "DEPENDS-ON"].join("\t"),
          ...rows.map((row) =>
            [row.slug, row.status, row.dependsOn.join(",")].join("\t"),
          ),
        ];
        emitList(rows, json, humanLines);
      } catch (error) {
        emitError(error, json);
      }
    });

  task
    .command("start")
    .description("Mark a task as in-progress")
    .argument("<slug>", "feature folder slug")
    .argument("<task>", "task slug")
    .option("--json", "output as structured JSON")
    .action(
      async (
        slug: string,
        taskSlug: string,
        _options: unknown,
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          const result = await updateTaskStatus(
            cwd(),
            slug,
            taskSlug,
            "in-progress",
          );
          emitSuccess(
            { action: "task-start", ...result },
            json,
            `task ${result.taskSlug} (feature: ${result.featureSlug}): ${result.previousStatus} → ${result.newStatus}`,
          );
        } catch (error) {
          emitError(error, json);
        }
      },
    );

  task
    .command("done")
    .description("Mark a task as done (requires task to be in-progress)")
    .argument("<slug>", "feature folder slug")
    .argument("<task>", "task slug")
    .option("--json", "output as structured JSON")
    .action(
      async (
        slug: string,
        taskSlug: string,
        _options: unknown,
        command: Command,
      ) => {
        const json = jsonMode(command);
        try {
          const result = await updateTaskStatus(cwd(), slug, taskSlug, "done");
          emitSuccess(
            { action: "task-done", ...result },
            json,
            `task ${result.taskSlug} (feature: ${result.featureSlug}): ${result.previousStatus} → ${result.newStatus}`,
          );
        } catch (error) {
          emitError(error, json);
        }
      },
    );
}
