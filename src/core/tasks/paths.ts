import { join } from "node:path";
import { buildFeatureDirectoryPath } from "../specs/paths.js";

export function buildTasksDirectoryPath(
  projectRoot: string,
  featureSlug: string,
): string {
  return join(buildFeatureDirectoryPath(projectRoot, featureSlug), "tasks");
}

export function buildTaskFilePath(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
): string {
  return join(buildTasksDirectoryPath(projectRoot, featureSlug), `${taskSlug}.md`);
}
