import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readFixFile } from './frontmatter.js';
import { buildFixesDirectoryPath } from './paths.js';
import type { FixFrontmatter } from './types.js';

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function listFixes(
  projectRoot: string,
  featureSlug: string,
): Promise<FixFrontmatter[]> {
  const fixesDir = buildFixesDirectoryPath(projectRoot, featureSlug);

  const entries = await readdir(fixesDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingPathError(error)) return [];
    throw error;
  });

  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  const results = await Promise.all(
    mdFiles.map(async (entry) => {
      const file = await readFixFile(join(fixesDir, entry.name));
      return file.frontmatter;
    }),
  );

  return results;
}

export async function listOpenFixes(
  projectRoot: string,
  featureSlug: string,
): Promise<FixFrontmatter[]> {
  const fixes = await listFixes(projectRoot, featureSlug);
  return fixes.filter((f) => f.status === 'open' || f.status === 'in-progress');
}

export interface FixFileLocation {
  filePath: string;
  frontmatter: FixFrontmatter;
}

export async function findFixById(
  projectRoot: string,
  featureSlug: string,
  fixId: string,
): Promise<FixFileLocation | undefined> {
  const fixesDir = buildFixesDirectoryPath(projectRoot, featureSlug);

  const entries = await readdir(fixesDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingPathError(error)) return [];
    throw error;
  });

  const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  for (const entry of mdFiles) {
    const filePath = join(fixesDir, entry.name);
    const file = await readFixFile(filePath);
    if (file.frontmatter.id === fixId) {
      return { filePath, frontmatter: file.frontmatter };
    }
  }

  return undefined;
}
