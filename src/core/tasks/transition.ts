import { SpecflowError } from '../output/errors.js';
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
      throw new SpecflowError(
        'NOT_FOUND',
        `Task "${taskSlug}" does not exist in feature "${featureSlug}".`,
        { hint: 'Run `specflow task list <slug>` to see available tasks.' },
      );
    }
    throw error;
  });

  if (targetStatus === 'done' && file.frontmatter.status !== 'in-progress') {
    throw new SpecflowError(
      'PRECONDITION_FAILED',
      `Cannot mark task ${taskSlug} as done: task is not in-progress (current status: ${file.frontmatter.status}).`,
      { hint: 'Start it first with `specflow task start <slug> <task>`.' },
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
