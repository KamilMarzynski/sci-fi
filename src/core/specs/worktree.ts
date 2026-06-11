import { writeFile } from 'node:fs/promises';
import { ScifiError } from '../output/errors.js';
import { inspectFeatureLifecycle } from './lifecycle.js';
import { buildFeatureMetadataPath } from './paths.js';
import type { FeatureMetadata } from './types.js';

export interface SetFeatureWorktreeInput {
  branch: string;
  path: string;
}

export interface SetFeatureWorktreeResult {
  id: string;
  slug: string;
  branch: string;
  worktreePath: string;
}

export async function setFeatureWorktree(
  projectRoot: string,
  slug: string,
  input: SetFeatureWorktreeInput,
): Promise<SetFeatureWorktreeResult> {
  const branch = input.branch.trim();
  const worktreePath = input.path.trim();

  if (branch.length === 0) {
    throw new ScifiError('INVALID_ARGUMENT', 'Branch must not be empty.', {
      hint: 'Pass --branch <branch-name>.',
    });
  }
  if (worktreePath.length === 0) {
    throw new ScifiError('INVALID_ARGUMENT', 'Worktree path must not be empty.', {
      hint: 'Pass --path <worktree-path>.',
    });
  }

  const { metadata } = await inspectFeatureLifecycle(projectRoot, slug);

  const updatedMetadata: FeatureMetadata = {
    ...metadata,
    branch,
    worktreePath,
  };

  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);
  await writeFile(metadataPath, `${JSON.stringify(updatedMetadata, null, 2)}\n`, 'utf8');

  return {
    id: metadata.id,
    slug: metadata.slug,
    branch,
    worktreePath,
  };
}
