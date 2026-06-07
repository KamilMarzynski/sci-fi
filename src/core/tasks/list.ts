import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTaskFile } from './frontmatter.js';
import { buildTasksDirectoryPath } from './paths.js';
import type { TaskFrontmatter } from './types.js';

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function listTasks(
  projectRoot: string,
  featureSlug: string,
): Promise<TaskFrontmatter[]> {
  const tasksDir = buildTasksDirectoryPath(projectRoot, featureSlug);

  const entries = await readdir(tasksDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingPathError(error)) return [];
    throw error;
  });

  const taskFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

  return Promise.all(
    taskFiles.map((entry) =>
      readTaskFile(join(tasksDir, entry.name)).then((file) => file.frontmatter),
    ),
  );
}
