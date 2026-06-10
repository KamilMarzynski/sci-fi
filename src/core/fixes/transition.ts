import { ScifiError } from '../output/errors.js';
import { readFixFile, writeFixFile } from './frontmatter.js';
import { findFixById } from './list.js';
import type { FixStatus } from './types.js';

export interface UpdateFixStatusResult {
  featureSlug: string;
  id: string;
  slug: string;
  previousStatus: FixStatus;
  newStatus: FixStatus;
}

export async function updateFixStatus(
  projectRoot: string,
  featureSlug: string,
  fixId: string,
  targetStatus: FixStatus,
): Promise<UpdateFixStatusResult> {
  const location = await findFixById(projectRoot, featureSlug, fixId);

  if (location === undefined) {
    throw new ScifiError(
      'NOT_FOUND',
      `Fix "${fixId}" does not exist in feature "${featureSlug}".`,
      { hint: "Run `scifi status <slug>` to see this feature's fixes." },
    );
  }

  const previousStatus = location.frontmatter.status;

  if (previousStatus !== 'open' && previousStatus !== 'in-progress') {
    throw new ScifiError(
      'PRECONDITION_FAILED',
      `Cannot transition fix ${fixId}: it is already ${previousStatus}.`,
      { hint: 'Only open or in-progress fixes can be resolved or marked wont-fix.' },
    );
  }

  const file = await readFixFile(location.filePath);

  await writeFixFile(location.filePath, {
    ...file,
    frontmatter: { ...file.frontmatter, status: targetStatus },
  });

  return {
    featureSlug,
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    previousStatus,
    newStatus: targetStatus,
  };
}
