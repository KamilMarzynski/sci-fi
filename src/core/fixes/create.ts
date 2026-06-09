import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ScifiError } from '../output/errors.js';
import { slugify } from '../slugify.js';
import { buildFeatureDirectoryPath } from '../specs/paths.js';
import { writeFixFile } from './frontmatter.js';
import { formatFixId } from './id.js';
import { buildFixesDirectoryPath, buildFixFilePath } from './paths.js';

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export interface CreateFixOptions {
  projectRoot: string;
  description: string;
  featureSlug: string;
  now: string;
}

export interface CreateFixResult {
  id: string;
  filePath: string;
}

export async function createFix(options: CreateFixOptions): Promise<CreateFixResult> {
  const { projectRoot, description, featureSlug, now } = options;

  const featureDir = buildFeatureDirectoryPath(projectRoot, featureSlug);
  const metadataPath = join(featureDir, '.scifi.json');
  await stat(metadataPath).catch((error: unknown) => {
    if (isMissingPathError(error)) {
      throw new ScifiError('NOT_FOUND', `Feature "${featureSlug}" does not exist.`, {
        hint: `Create it with \`scifi spec ${featureSlug}\`.`,
      });
    }
    throw error;
  });

  const fixesDir = buildFixesDirectoryPath(projectRoot, featureSlug);
  await mkdir(fixesDir, { recursive: true });

  const existing = await readdir(fixesDir, { withFileTypes: true });
  const mdCount = existing.filter((e) => e.isFile() && e.name.endsWith('.md')).length;

  const id = formatFixId(mdCount + 1);
  const slug = slugify(description);
  const filePath = buildFixFilePath(projectRoot, featureSlug, id, slug);

  await writeFixFile(filePath, {
    frontmatter: {
      id,
      slug,
      status: 'open',
      feature: featureSlug,
      created: now,
    },
    body: `# ${description}\n`,
  });

  return { id, filePath };
}
