import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { claudeCodeAdapter } from '../../../../src/core/skills/harness/claude-code.js';
import type { SkillBundle } from '../../../../src/core/skills/types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

function createProjectRoot(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), 'specflow-cc-adapter-'));
  temporaryDirectories.push(projectRoot);
  return projectRoot;
}

describe('claudeCodeAdapter', () => {
  it('writes .claude/skills/<id>/SKILL.md with full frontmatter and body', async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: 'sf-feature',
        description: 'Start grilling session for a new feature.',
        argumentHint: '[title]',
        allowedTools: ['Read', 'Write'],
      },
      body: '# sf-feature\n\nstub body\n',
      assets: [],
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, '.claude', 'skills', 'sf-feature', 'SKILL.md'),
      'utf8',
    );
    const [frontmatterBlock, ...bodyLines] = splitFrontmatter(written);
    const frontmatter = parse(frontmatterBlock);

    expect(frontmatter).toEqual({
      name: 'sf-feature',
      description: 'Start grilling session for a new feature.',
      'argument-hint': '[title]',
      'allowed-tools': 'Read, Write',
    });
    expect(bodyLines.join('\n')).toBe('# sf-feature\n\nstub body\n');
  });

  it('writes companion assets beside SKILL.md', async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: 'sf-feature',
        description: 'Start grilling session for a new feature.',
      },
      body: '# sf-feature\n',
      assets: [{ name: 'SPEC-TEMPLATE.md', contents: '# Spec: <title>\n' }],
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, '.claude', 'skills', 'sf-feature', 'SPEC-TEMPLATE.md'),
      'utf8',
    );
    expect(written).toBe('# Spec: <title>\n');
  });

  it('omits optional frontmatter keys when not provided', async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: 'sf-bug',
        description: 'Create a bug report.',
      },
      body: '# sf-bug\n',
      assets: [],
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, '.claude', 'skills', 'sf-bug', 'SKILL.md'),
      'utf8',
    );
    const [frontmatterBlock] = splitFrontmatter(written);
    const frontmatter = parse(frontmatterBlock);

    expect(frontmatter).toEqual({
      name: 'sf-bug',
      description: 'Create a bug report.',
    });
  });
});

function splitFrontmatter(contents: string): [string, string] {
  const trimmed = contents.startsWith('---\n') ? contents.slice(4) : contents;
  const closingIndex = trimmed.indexOf('\n---\n');

  if (closingIndex === -1) {
    throw new Error('Missing closing frontmatter marker');
  }

  return [trimmed.slice(0, closingIndex), trimmed.slice(closingIndex + 5)];
}
