import { mkdir, stat, writeFile } from 'node:fs/promises';
import { ScifiError } from '../output/errors.js';
import { createInitialFeatureMetadata } from './metadata.js';
import {
  buildFeatureDirectoryPath,
  buildFeatureMetadataPath,
  buildFeaturesRootPath,
} from './paths.js';

export interface CreateFeatureOptions {
  projectRoot: string;
  slug: string;
  title?: string;
  now: string;
}

export interface CreateFeatureResult {
  featureDirectoryPath: string;
  metadataPath: string;
}

export async function createFeature(options: CreateFeatureOptions): Promise<CreateFeatureResult> {
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
    throw new ScifiError(
      'CONFLICT',
      `Cannot create feature ${slug}: ${featureDirectoryPath} already exists.`,
      { hint: 'Choose a different slug or inspect it with `scifi status <slug>`.' },
    );
  }

  await mkdir(featuresRootPath, { recursive: true });

  await mkdir(featureDirectoryPath, { recursive: false });

  const metadata = createInitialFeatureMetadata({
    slug,
    ...(title !== undefined && { title }),
    createdAt: now,
  });

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    featureDirectoryPath,
    metadataPath,
  };
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
