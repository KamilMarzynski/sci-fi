import { join } from 'node:path';
import { assertSafeSlug } from '../slugify.js';

export function buildFeaturesRootPath(projectRoot: string): string {
  return join(projectRoot, 'docs', 'specflow', 'specs');
}

export function buildFeatureDirectoryPath(projectRoot: string, slug: string): string {
  assertSafeSlug(slug, 'feature slug');
  return join(buildFeaturesRootPath(projectRoot), slug);
}

export function buildFeatureMetadataPath(projectRoot: string, slug: string): string {
  return join(buildFeatureDirectoryPath(projectRoot, slug), '.specflow.json');
}
