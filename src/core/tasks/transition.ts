import { readTaskFile, writeTaskFile } from "./frontmatter.js";
import { buildTaskFilePath } from "./paths.js";
import type { TaskStatus } from "./types.js";

export async function updateTaskStatus(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
  targetStatus: TaskStatus,
): Promise<void> {
  const filePath = buildTaskFilePath(projectRoot, featureSlug, taskSlug);
  const file = await readTaskFile(filePath);

  if (targetStatus === "done" && file.frontmatter.status !== "in-progress") {
    throw new Error(
      `Cannot mark task ${taskSlug} as done: task is not in-progress (current status: ${file.frontmatter.status}).`,
    );
  }

  await writeTaskFile(filePath, {
    ...file,
    frontmatter: { ...file.frontmatter, status: targetStatus },
  });
}
