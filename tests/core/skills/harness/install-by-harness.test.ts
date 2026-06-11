import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getAdapter } from '../../../../src/core/skills/harness/registry.js';
import type { SkillBundle } from '../../../../src/core/skills/types.js';
import '../../../../src/core/skills/harness/register-defaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..', '..', '..');

async function loadCatalogFromPackage(): Promise<SkillBundle[]> {
  const { loadCatalog } = await import('../../../../src/core/skills/catalog.js');
  return loadCatalog({
    bodiesRoot: join(packageRoot, 'skills'),
    manifestsRoot: join(packageRoot, 'dist', 'skills'),
  });
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

const HARNESS_BASE_DIRS: Record<string, string> = {
  'claude-code': join('.claude', 'skills'),
  opencode: join('.opencode', 'skills'),
  codex: join('.codex', 'skills'),
  cursor: join('.cursor', 'skills'),
};

describe('install-by-harness', () => {
  it('each harness adapter has the correct skillsBaseDir', () => {
    for (const [id, expectedBaseDir] of Object.entries(HARNESS_BASE_DIRS)) {
      const adapter = getAdapter(id as 'claude-code' | 'opencode' | 'codex' | 'cursor');
      expect(adapter.skillsBaseDir).toBe(expectedBaseDir);
    }
  });

  it('installs the catalog to per-harness base dirs and all SKILL.md files are byte-identical', async () => {
    const bundles = await loadCatalogFromPackage();
    expect(bundles.length).toBeGreaterThan(0);

    const harnessIds = ['claude-code', 'opencode', 'codex', 'cursor'] as const;
    const projectRoots: Record<string, string> = {};

    for (const id of harnessIds) {
      const projectRoot = mkdtempSync(join(tmpdir(), `scifi-${id}-`));
      temporaryDirectories.push(projectRoot);
      projectRoots[id] = projectRoot;

      const adapter = getAdapter(id);
      await adapter.install(bundles, projectRoot);
    }

    // Compare every SKILL.md and asset across harnesses: must be byte-identical
    for (const bundle of bundles) {
      const skillId = bundle.manifest.id;

      // Read SKILL.md from each harness
      const skillMdContents = await Promise.all(
        harnessIds.map((id) => {
          const baseDir = HARNESS_BASE_DIRS[id];
          return readFile(join(projectRoots[id], baseDir, skillId, 'SKILL.md'), 'utf8');
        }),
      );

      // All four should be identical to the first
      const reference = skillMdContents[0];
      for (let i = 1; i < skillMdContents.length; i++) {
        expect(skillMdContents[i]).toBe(reference);
      }

      // Check assets too
      for (const asset of bundle.assets) {
        const assetContents = await Promise.all(
          harnessIds.map((id) => {
            const baseDir = HARNESS_BASE_DIRS[id];
            return readFile(join(projectRoots[id], baseDir, skillId, asset.name), 'utf8');
          }),
        );

        const refAsset = assetContents[0];
        for (let i = 1; i < assetContents.length; i++) {
          expect(assetContents[i]).toBe(refAsset);
        }
      }
    }
  });
});
