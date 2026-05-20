import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildFeatureDirectoryPath, buildFeatureMetadataPath } from "./paths.js";
import type { FeatureMetadata, FeatureStatus } from "./types.js";

export interface FeatureArtifacts {
  specExists: boolean;
  architectureExists: boolean;
  taskFileCount: number;
}

export interface FeatureLifecycle {
  metadata: FeatureMetadata;
  artifacts: FeatureArtifacts;
}

async function pathIsRegularFile(filePath: string): Promise<boolean> {
  const entry = await stat(filePath).catch(() => null);
  return entry?.isFile() ?? false;
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isValidFeatureMetadata(value: unknown): value is FeatureMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    "version" in obj &&
    typeof obj.version === "number" &&
    "id" in obj &&
    typeof obj.id === "string" &&
    "slug" in obj &&
    typeof obj.slug === "string" &&
    "status" in obj &&
    typeof obj.status === "string" &&
    "createdAt" in obj &&
    typeof obj.createdAt === "string" &&
    "updatedAt" in obj &&
    typeof obj.updatedAt === "string"
  );
}

export async function inspectFeatureLifecycle(
  projectRoot: string,
  slug: string,
): Promise<FeatureLifecycle> {
  const featureRoot = buildFeatureDirectoryPath(projectRoot, slug);
  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);
  const parsed = JSON.parse(await readFile(metadataPath, "utf8"));

  if (!isValidFeatureMetadata(parsed)) {
    throw new Error(`Invalid metadata file at ${metadataPath}`);
  }

  const metadata = parsed;

  const specExists = await pathIsRegularFile(join(featureRoot, "spec.md"));
  const architectureExists = await pathIsRegularFile(
    join(featureRoot, "architecture.md"),
  );
  const taskEntries = await readdir(join(featureRoot, "tasks"), {
    withFileTypes: true,
  }).catch((error: unknown) => {
    if (isMissingPathError(error)) {
      return [];
    }
    throw error;
  });
  const taskFileCount = taskEntries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".md"),
  ).length;

  return {
    metadata,
    artifacts: {
      specExists,
      architectureExists,
      taskFileCount,
    },
  };
}

export async function validateStatusTransition(
  artifacts: FeatureArtifacts,
  targetStatus: FeatureStatus,
): Promise<void> {
  if (targetStatus === "spec-ready" && !artifacts.specExists) {
    throw new Error("Cannot mark feature as spec-ready: spec.md is missing.");
  }

  if (targetStatus === "plan-ready") {
    if (!artifacts.architectureExists) {
      throw new Error("Cannot mark feature as plan-ready: architecture.md is missing.");
    }

    if (artifacts.taskFileCount < 1) {
      throw new Error("Cannot mark feature as plan-ready: no task files were found.");
    }
  }
}
