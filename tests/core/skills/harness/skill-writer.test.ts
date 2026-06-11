import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { writeSkillBundles } from '../../../../src/core/skills/harness/skill-writer.js';
import type { SkillBundle } from '../../../../src/core/skills/types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

function createSkillsRoot(): string {
  const skillsRoot = mkdtempSync(join(tmpdir(), 'scifi-skill-writer-'));
  temporaryDirectories.push(skillsRoot);
  return skillsRoot;
}

describe('writeSkillBundles', () => {
  it('writes <skillsRoot>/<id>/SKILL.md for each bundle', async () => {
    const skillsRoot = createSkillsRoot();
    const bundles: SkillBundle[] = [
      {
        manifest: { id: 'sf-feature', description: 'Start grilling session.' },
        body: '# sf-feature\n',
        assets: [],
      },
      {
        manifest: { id: 'sf-bug', description: 'Fix a bug.' },
        body: '# sf-bug\n',
        assets: [],
      },
    ];

    await writeSkillBundles(bundles, skillsRoot);

    const featureSkill = readFileSync(join(skillsRoot, 'sf-feature', 'SKILL.md'), 'utf8');
    const bugSkill = readFileSync(join(skillsRoot, 'sf-bug', 'SKILL.md'), 'utf8');

    expect(featureSkill).toContain('sf-feature');
    expect(bugSkill).toContain('sf-bug');
  });

  it('copies every asset alongside SKILL.md', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: { id: 'sf-feature', description: 'Start grilling session.' },
      body: '# sf-feature\n',
      assets: [
        { name: 'SPEC-TEMPLATE.md', contents: '# Spec\n' },
        { name: 'helper.sh', contents: '#!/bin/sh\n' },
      ],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const spec = readFileSync(join(skillsRoot, 'sf-feature', 'SPEC-TEMPLATE.md'), 'utf8');
    const helper = readFileSync(join(skillsRoot, 'sf-feature', 'helper.sh'), 'utf8');

    expect(spec).toBe('# Spec\n');
    expect(helper).toBe('#!/bin/sh\n');
  });

  it('includes name and description in SKILL.md frontmatter', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: { id: 'sf-plan', description: 'Deep technical planning.' },
      body: '# sf-plan\n',
      assets: [],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const written = readFileSync(join(skillsRoot, 'sf-plan', 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(written);

    expect(frontmatter).toMatchObject({ name: 'sf-plan', description: 'Deep technical planning.' });
  });

  it('includes argument-hint in frontmatter when manifest provides it', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: { id: 'sf-feature', description: 'New feature.', argumentHint: '[title]' },
      body: '# sf-feature\n',
      assets: [],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const written = readFileSync(join(skillsRoot, 'sf-feature', 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(written);

    expect(frontmatter['argument-hint']).toBe('[title]');
  });

  it('omits argument-hint from frontmatter when manifest does not provide it', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: { id: 'sf-feature', description: 'New feature.' },
      body: '# sf-feature\n',
      assets: [],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const written = readFileSync(join(skillsRoot, 'sf-feature', 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(written);

    expect(frontmatter).not.toHaveProperty('argument-hint');
  });

  it('includes allowed-tools in frontmatter when manifest provides them', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: 'sf-tdd',
        description: 'TDD skill.',
        allowedTools: ['Read', 'Write', 'Bash'],
      },
      body: '# sf-tdd\n',
      assets: [],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const written = readFileSync(join(skillsRoot, 'sf-tdd', 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(written);

    expect(frontmatter['allowed-tools']).toBe('Read, Write, Bash');
  });

  it('omits allowed-tools from frontmatter when manifest does not provide them', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: { id: 'sf-tdd', description: 'TDD skill.' },
      body: '# sf-tdd\n',
      assets: [],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const written = readFileSync(join(skillsRoot, 'sf-tdd', 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(written);

    expect(frontmatter).not.toHaveProperty('allowed-tools');
  });

  it('overwrites an existing SKILL.md without error', async () => {
    const skillsRoot = createSkillsRoot();
    const bundle: SkillBundle = {
      manifest: { id: 'sf-feature', description: 'First version.' },
      body: '# sf-feature v1\n',
      assets: [],
    };

    await writeSkillBundles([bundle], skillsRoot);

    const updated: SkillBundle = {
      manifest: { id: 'sf-feature', description: 'Second version.' },
      body: '# sf-feature v2\n',
      assets: [],
    };

    await writeSkillBundles([updated], skillsRoot);

    const written = readFileSync(join(skillsRoot, 'sf-feature', 'SKILL.md'), 'utf8');
    expect(written).toContain('Second version');
    expect(written).toContain('v2');
  });
});

function parseFrontmatter(contents: string): Record<string, unknown> {
  const trimmed = contents.startsWith('---\n') ? contents.slice(4) : contents;
  const closingIndex = trimmed.indexOf('\n---\n');

  if (closingIndex === -1) {
    throw new Error('Missing closing frontmatter marker');
  }

  return parse(trimmed.slice(0, closingIndex)) as Record<string, unknown>;
}
