import { readdir, readFile } from "node:fs/promises";
import { buildFeaturesRootPath, buildFeatureMetadataPath } from "./paths.js";
import type { FeatureMetadata, FeatureStatus } from "./types.js";

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isValidFeatureMetadata(value: unknown): value is FeatureMetadata {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    "version" in obj &&
    typeof obj["version"] === "number" &&
    "id" in obj &&
    typeof obj["id"] === "string" &&
    "slug" in obj &&
    typeof obj["slug"] === "string" &&
    "status" in obj &&
    typeof obj["status"] === "string" &&
    "createdAt" in obj &&
    typeof obj["createdAt"] === "string" &&
    "updatedAt" in obj &&
    typeof obj["updatedAt"] === "string"
  );
}

export interface ListFeaturesOptions {
  projectRoot: string;
  status?: FeatureStatus;
}

export async function listFeatures(
  options: ListFeaturesOptions,
): Promise<FeatureMetadata[]> {
  const { projectRoot, status } = options;
  const specsRoot = buildFeaturesRootPath(projectRoot);

  const entries = await readdir(specsRoot, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissingPathError(error)) return [];
      throw error;
    },
  );

  const featureDirs = entries.filter((entry) => entry.isDirectory());

  const allResults = await Promise.all(
    featureDirs.map(async (dir) => {
      const metadataPath = buildFeatureMetadataPath(projectRoot, dir.name);
      const raw = JSON.parse(await readFile(metadataPath, "utf8")) as unknown;
      if (!isValidFeatureMetadata(raw)) return null;
      return raw;
    }),
  );

  const features = allResults.filter((m): m is FeatureMetadata => m !== null);

  if (status !== undefined) {
    return features.filter((f) => f.status === status);
  }

  return features;
}
