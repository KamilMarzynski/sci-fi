import { join } from 'node:path';
import { assertSafeSlug } from '../slugify.js';
import { buildFeatureDirectoryPath } from '../specs/paths.js';

export function buildTasksDirectoryPath(projectRoot: string, featureSlug: string): string {
  return join(buildFeatureDirectoryPath(projectRoot, featureSlug), 'tasks');
}

export function buildTaskFilePath(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
): string {
  assertSafeSlug(taskSlug, 'task slug');
  return join(buildTasksDirectoryPath(projectRoot, featureSlug), `${taskSlug}.md`);
}
