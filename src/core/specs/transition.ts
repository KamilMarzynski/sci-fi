import { writeFile } from "node:fs/promises";
import { listTasks } from "../tasks/list.js";
import { buildFeatureMetadataPath } from "./paths.js";
import { inspectFeatureLifecycle, validateStatusTransition } from "./lifecycle.js";
import type { FeatureMetadata, FeatureStatus } from "./types.js";

export interface UpdateFeatureStatusResult {
  id: string;
  slug: string;
  previousStatus: FeatureStatus;
  newStatus: FeatureStatus;
  timestamp: string;
}

export async function updateFeatureStatus(
  projectRoot: string,
  slug: string,
  targetStatus: FeatureStatus,
  now: string,
): Promise<UpdateFeatureStatusResult> {
  const lifecycle = await inspectFeatureLifecycle(projectRoot, slug);
  const tasks = await listTasks(projectRoot, slug);
  const allTasksDone =
    tasks.length > 0 && tasks.every((t) => t.status === "done");

  await validateStatusTransition(lifecycle.artifacts, targetStatus, {
    currentStatus: lifecycle.metadata.status,
    allTasksDone,
  });

  const metadata = lifecycle.metadata;
  const updatedMetadata: FeatureMetadata = {
    version: metadata.version,
    id: metadata.id,
    slug: metadata.slug,
    ...(metadata.title !== undefined && { title: metadata.title }),
    status: targetStatus,
    createdAt: metadata.createdAt,
    updatedAt: now,
  };

  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);
  await writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2) + "\n", "utf8");

  return {
    id: metadata.id,
    slug: metadata.slug,
    previousStatus: metadata.status,
    newStatus: targetStatus,
    timestamp: now,
  };
}
