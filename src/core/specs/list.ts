import { readdir, readFile } from 'node:fs/promises';
import { buildFeatureMetadataPath, buildFeaturesRootPath } from './paths.js';
import type { FeatureListItem, FeatureMetadata, FeatureStatus } from './types.js';
import type { WorktreeProvider } from './worktree-discovery.js';

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function worktreePathFromLocation(location: `worktree:${string}`): string {
  return location.slice('worktree:'.length);
}

function isWorktreeLocation(
  location: FeatureListItem['location'],
): location is `worktree:${string}` {
  return location !== 'local';
}

function isValidFeatureMetadata(value: unknown): value is FeatureMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    'version' in obj &&
    typeof obj.version === 'number' &&
    'slug' in obj &&
    typeof obj.slug === 'string' &&
    'status' in obj &&
    typeof obj.status === 'string' &&
    'createdAt' in obj &&
    typeof obj.createdAt === 'string' &&
    'updatedAt' in obj &&
    typeof obj.updatedAt === 'string'
  );
}

async function loadFeatureMetadata(projectRoot: string): Promise<FeatureMetadata[]> {
  const specsRoot = buildFeaturesRootPath(projectRoot);

  const entries = await readdir(specsRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingPathError(error)) return [];
    throw error;
  });

  const featureDirs = entries.filter((entry) => entry.isDirectory());

  const allResults = await Promise.all(
    featureDirs.map(async (dir) => {
      const metadataPath = buildFeatureMetadataPath(projectRoot, dir.name);
      const raw = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown;
      if (!isValidFeatureMetadata(raw)) return null;
      return raw;
    }),
  );

  return allResults.filter((m): m is FeatureMetadata => m !== null);
}

async function loadFeaturesFromWorktree(
  _projectRoot: string,
  worktreePath: string,
): Promise<FeatureListItem[]> {
  try {
    const metadata = await loadFeatureMetadata(worktreePath);
    return metadata.map((item) => ({ metadata: item, location: `worktree:${worktreePath}` }));
  } catch {
    return [];
  }
}

export interface ListFeaturesOptions {
  projectRoot: string;
  status?: FeatureStatus;
  worktreeProvider?: WorktreeProvider;
}

export async function listFeatures(options: ListFeaturesOptions): Promise<FeatureListItem[]> {
  const { projectRoot, status, worktreeProvider } = options;

  const localMetadata = await loadFeatureMetadata(projectRoot);
  const merged = new Map<string, FeatureListItem>();
  for (const metadata of localMetadata) {
    merged.set(metadata.slug, { metadata, location: 'local' });
  }

  if (worktreeProvider !== undefined) {
    const worktrees = await worktreeProvider.discover(projectRoot);
    for (const worktree of worktrees) {
      if (worktree.isCurrent) continue;
      const features = await loadFeaturesFromWorktree(projectRoot, worktree.path);
      for (const feature of features) {
        const existing = merged.get(feature.metadata.slug);
        if (existing === undefined) {
          merged.set(feature.metadata.slug, feature);
          continue;
        }
        if (isWorktreeLocation(existing.location) && isWorktreeLocation(feature.location)) {
          const existingPath = worktreePathFromLocation(existing.location);
          const candidatePath = worktreePathFromLocation(feature.location);
          if (candidatePath < existingPath) {
            merged.set(feature.metadata.slug, feature);
          }
        }
      }
    }
  }

  let features = [...merged.values()].sort((a, b) =>
    a.metadata.slug.localeCompare(b.metadata.slug),
  );

  if (status !== undefined) {
    features = features.filter((f) => f.metadata.status === status);
  }

  return features;
}
