import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type SkillAsset,
  type SkillBundle,
  type SkillManifest,
  skillManifestSchema,
} from './types.js';

const NON_ASSET_FILES = new Set(['body.md', 'manifest.ts', 'manifest.js']);

export interface LoadCatalogOptions {
  readonly bodiesRoot: string;
  readonly manifestsRoot: string;
}

export async function loadCatalog(options: LoadCatalogOptions): Promise<SkillBundle[]> {
  const entries = await readdir(options.bodiesRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const seenIds = new Set<string>();
  const bundles: SkillBundle[] = [];

  for (const folder of directories) {
    const manifest = await loadManifest(join(options.manifestsRoot, folder, 'manifest.js'));

    if (manifest.id !== folder) {
      throw new Error(`manifest.id "${manifest.id}" does not match folder "${folder}"`);
    }

    if (seenIds.has(manifest.id)) {
      throw new Error(`Duplicate skill id "${manifest.id}"`);
    }

    seenIds.add(manifest.id);

    const bodyPath = join(options.bodiesRoot, folder, 'body.md');
    await assertFileExists(bodyPath);
    const body = await readFile(bodyPath, { encoding: 'utf8' });

    const assets = await loadAssets(join(options.bodiesRoot, folder));

    bundles.push({ manifest, body, assets });
  }

  return bundles;
}

async function loadAssets(skillDirectory: string): Promise<SkillAsset[]> {
  const entries = await readdir(skillDirectory, { withFileTypes: true });
  const assetNames = entries
    .filter((entry) => entry.isFile() && !NON_ASSET_FILES.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  const assets: SkillAsset[] = [];
  for (const name of assetNames) {
    const contents = await readFile(join(skillDirectory, name), { encoding: 'utf8' });
    assets.push({ name, contents });
  }

  return assets;
}

async function loadManifest(modulePath: string): Promise<SkillManifest> {
  await assertFileExists(modulePath);
  const moduleUrl = pathToFileURL(modulePath).href;
  const imported = (await import(moduleUrl)) as { manifest?: unknown };

  if (imported.manifest === undefined) {
    throw new Error(`manifest export missing from ${modulePath}`);
  }

  const result = skillManifestSchema.safeParse(imported.manifest);
  if (!result.success) {
    throw new Error(
      `Invalid manifest at ${modulePath}: ${result.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  return result.data;
}

async function assertFileExists(path: string): Promise<void> {
  await stat(path).catch((error: unknown) => {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      throw new Error(`Missing file: ${path}`);
    }

    throw error;
  });
}
