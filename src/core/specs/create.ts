import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { buildFeaturesRootPath, buildFeatureDirectoryPath, buildFeatureMetadataPath } from "./paths.js";
import { createInitialFeatureMetadata } from "./metadata.js";
import { formatFeatureId } from "./id.js";

export interface CreateFeatureOptions {
  projectRoot: string;
  slug: string;
  title?: string;
  now: string;
}

export interface CreateFeatureResult {
  id: string;
  featureDirectoryPath: string;
  metadataPath: string;
}

export async function createFeature(
  options: CreateFeatureOptions,
): Promise<CreateFeatureResult> {
  const { projectRoot, slug, title, now } = options;
  const featuresRootPath = buildFeaturesRootPath(projectRoot);
  const featureDirectoryPath = buildFeatureDirectoryPath(projectRoot, slug);
  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);

  const existingFeatureDirectory = await stat(featureDirectoryPath).catch(
    (error: unknown): null => {
      if (isMissingPathError(error)) {
        return null;
      }

      throw error;
    },
  );

  if (existingFeatureDirectory !== null) {
    throw new Error(
      `Cannot create feature ${slug}: ${featureDirectoryPath} already exists.`,
    );
  }

  await mkdir(featuresRootPath, { recursive: true });

  const existingEntries = await readdir(featuresRootPath, {
    withFileTypes: true,
  });
  const nextId = formatFeatureId(existingEntries.filter((entry) => entry.isDirectory()).length + 1);

  await mkdir(featureDirectoryPath, { recursive: false });

  const metadata = createInitialFeatureMetadata({
    id: nextId,
    slug,
    ...(title !== undefined && { title }),
    createdAt: now,
  });

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");

  return {
    id: nextId,
    featureDirectoryPath,
    metadataPath,
  };
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
