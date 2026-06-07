import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { SpecflowError } from "../output/errors.js";
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

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function pathIsRegularFile(filePath: string): Promise<boolean> {
  try {
    const entry = await stat(filePath);
    return entry.isFile();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
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
  const rawMetadata = await readFile(metadataPath, "utf8").catch(
    (error: unknown): never => {
      if (isMissingPathError(error)) {
        throw new SpecflowError(
          "NOT_FOUND",
          `Feature "${slug}" does not exist.`,
          { hint: `Create it with \`specflow spec ${slug}\`.`, cause: error },
        );
      }
      throw error;
    },
  );
  const parsed = JSON.parse(rawMetadata);

  if (!isValidFeatureMetadata(parsed)) {
    throw new SpecflowError(
      "INTERNAL",
      `Invalid metadata file at ${metadataPath}`,
    );
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

interface ValidationContext {
  currentStatus?: FeatureStatus;
  allTasksDone?: boolean;
}

export async function validateStatusTransition(
  artifacts: FeatureArtifacts,
  targetStatus: FeatureStatus,
  context?: ValidationContext,
): Promise<void> {
  if (targetStatus === "spec-ready" && !artifacts.specExists) {
    throw new SpecflowError(
      "PRECONDITION_FAILED",
      "Cannot mark feature as spec-ready: spec.md is missing.",
      { hint: "Write spec.md in the feature directory, then retry." },
    );
  }

  if (targetStatus === "plan-ready") {
    if (!artifacts.architectureExists) {
      throw new SpecflowError(
        "PRECONDITION_FAILED",
        "Cannot mark feature as plan-ready: architecture.md is missing.",
        { hint: "Write architecture.md in the feature directory, then retry." },
      );
    }
    if (artifacts.taskFileCount < 1) {
      throw new SpecflowError(
        "PRECONDITION_FAILED",
        "Cannot mark feature as plan-ready: no task files were found.",
        { hint: "Add at least one task under the feature's tasks/ directory." },
      );
    }
  }

  if (
    targetStatus === "in-progress" &&
    context?.currentStatus !== undefined &&
    context.currentStatus !== "plan-ready"
  ) {
    throw new SpecflowError(
      "PRECONDITION_FAILED",
      "Cannot start feature: feature must be plan-ready before starting implementation.",
      { hint: "Run `specflow plan-ready <slug>` first." },
    );
  }

  if (targetStatus === "done" && context?.allTasksDone === false) {
    throw new SpecflowError(
      "PRECONDITION_FAILED",
      "Cannot mark feature as done: not all tasks are complete.",
      { hint: "Finish remaining tasks with `specflow task done <slug> <task>`." },
    );
  }
}
