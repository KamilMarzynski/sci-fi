import { join } from "node:path";
import { buildFeatureDirectoryPath } from "../specs/paths.js";

export function buildFixesDirectoryPath(
  projectRoot: string,
  featureSlug: string,
): string {
  return join(buildFeatureDirectoryPath(projectRoot, featureSlug), "fixes");
}

export function buildFixFilePath(
  projectRoot: string,
  featureSlug: string,
  id: string,
  slug: string,
): string {
  return join(
    buildFixesDirectoryPath(projectRoot, featureSlug),
    `${id}-${slug}.md`,
  );
}
