import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import type { SkillBundle, SkillManifest } from '../types.js';
import type { HarnessAdapter } from './adapter.js';

export const claudeCodeAdapter: HarnessAdapter = {
  id: 'claude-code',
  async install(bundles, projectRoot) {
    for (const bundle of bundles) {
      const targetPath = join(projectRoot, '.claude', 'skills', bundle.manifest.id, 'SKILL.md');
      const document = renderDocument(bundle);

      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, document, { encoding: 'utf8' });
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

  if (manifest.disableModelInvocation === true) {
    frontmatter['disable-model-invocation'] = true;
  }

  return frontmatter;
}
