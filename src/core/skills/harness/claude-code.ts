import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { SkillBundle, SkillManifest } from '../types.js';
import type { HarnessAdapter } from './adapter.js';

export const claudeCodeAdapter: HarnessAdapter = {
  id: 'claude-code',
  async install(bundles, projectRoot) {
    for (const bundle of bundles) {
      const skillDirectory = join(projectRoot, '.claude', 'skills', bundle.manifest.id);
      const targetPath = join(skillDirectory, 'SKILL.md');
      const document = renderDocument(bundle);

      await mkdir(skillDirectory, { recursive: true });
      await writeFile(targetPath, document, { encoding: 'utf8' });

      for (const asset of bundle.assets) {
        await writeFile(join(skillDirectory, asset.name), asset.contents, { encoding: 'utf8' });
      }
    }
  },
};

function renderDocument(bundle: SkillBundle): string {
  const frontmatter = buildFrontmatter(bundle.manifest);
  const serialized = stringify(frontmatter).trimEnd();

  return `---\n${serialized}\n---\n${bundle.body}`;
}

function buildFrontmatter(manifest: SkillManifest): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    name: manifest.id,
    description: manifest.description,
  };

  if (manifest.argumentHint !== undefined) {
    frontmatter['argument-hint'] = manifest.argumentHint;
  }

  if (manifest.allowedTools !== undefined) {
    frontmatter['allowed-tools'] = manifest.allowedTools.join(', ');
  }

  return frontmatter;
}
