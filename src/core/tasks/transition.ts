import { ScifiError } from '../output/errors.js';
import { readTaskFile, writeTaskFile } from './frontmatter.js';
import { buildTaskFilePath } from './paths.js';
import type { TaskStatus } from './types.js';

export interface UpdateTaskStatusResult {
  featureSlug: string;
  taskSlug: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function updateTaskStatus(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
  targetStatus: TaskStatus,
): Promise<UpdateTaskStatusResult> {
  const filePath = buildTaskFilePath(projectRoot, featureSlug, taskSlug);
  const file = await readTaskFile(filePath).catch((error: unknown): never => {
    if (isMissingPathError(error)) {
      throw new ScifiError(
        'NOT_FOUND',
        `Task "${taskSlug}" does not exist in feature "${featureSlug}".`,
        { hint: 'Run `scifi task list <slug>` to see available tasks.' },
      );
    }
    throw error;
  });

  if (targetStatus === 'done' && file.frontmatter.status !== 'in-progress') {
    throw new ScifiError(
      'PRECONDITION_FAILED',
      `Cannot mark task ${taskSlug} as done: task is not in-progress (current status: ${file.frontmatter.status}).`,
      { hint: 'Start it first with `scifi task start <slug> <task>`.' },
    );
  }

  const previousStatus = file.frontmatter.status;

  await writeTaskFile(filePath, {
    ...file,
    frontmatter: { ...file.frontmatter, status: targetStatus },
  });

  return {
    featureSlug,
    taskSlug,
    previousStatus,
    newStatus: targetStatus,
  };
}
