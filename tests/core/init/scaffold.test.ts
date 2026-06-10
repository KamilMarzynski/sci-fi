import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { access, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scaffoldInit } from '../../../src/core/init/scaffold.js';

describe('scaffoldInit', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map(async (directory) => {
        const { rm } = await import('node:fs/promises');
        await rm(directory, { force: true, recursive: true });
      }),
    );
    temporaryDirectories.length = 0;
  });

  it('creates the base scifi directories and bootstrap docs', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-core-'));
    temporaryDirectories.push(projectRoot);

    await scaffoldInit({ projectRoot });

    await expectDirectory(join(projectRoot, 'docs', 'scifi', '.scifi'));
    await expectDirectory(join(projectRoot, 'docs', 'scifi', 'specs'));

    await expect(access(join(projectRoot, 'docs', 'scifi', 'EVALUATION.md'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
    await expect(access(join(projectRoot, 'docs', 'scifi', 'ROADMAP.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(
      access(join(projectRoot, 'docs', 'scifi', 'ARCHITECTURE.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(join(projectRoot, 'docs', 'scifi', 'adr'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(readFileSync(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), 'utf8')).toBe(
      expectedContextDocument,
    );

    await expect(access(join(projectRoot, 'docs', 'scifi', 'TESTING.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('preserves existing docs when rerun', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-core-'));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'scifi'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), '# Existing context\n', 'utf8');

    await scaffoldInit({ projectRoot });

    expect(readFileSync(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), 'utf8')).toBe(
      '# Existing context\n',
    );
  });

  it('fails when a doc path already exists as a directory', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-core-'));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), {
      recursive: true,
    });

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, 'docs', 'scifi', 'CONTEXT.md')}: path exists and is not a regular file.`,
    });
  });

  it('does not create bootstrap directories when a doc path conflicts', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-core-'));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), {
      recursive: true,
    });

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, 'docs', 'scifi', 'CONTEXT.md')}: path exists and is not a regular file.`,
    });

    await expect(access(join(projectRoot, 'docs', 'scifi', '.scifi'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('fails without partial writes when a scaffold directory path conflicts', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-core-'));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'scifi'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'scifi', 'specs'), 'conflict', 'utf8');

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold directory at ${join(projectRoot, 'docs', 'scifi', 'specs')}: path exists and is not a directory.`,
    });

    const conflictingEntry = await stat(join(projectRoot, 'docs', 'scifi', 'specs'));
    expect(conflictingEntry.isFile()).toBe(true);
    await expect(access(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

const expectedContextDocument = `# CONTEXT.md

> Project glossary. Every term used in specs must be defined here.
> If a term is missing during a spec session, define it and update this file.

## Terms

<!-- Template:
### TermName
**Definition:** One clear sentence.
**Distinct from:** Other terms it might be confused with.
**Used in:** Links to specs where it appears.
-->
`;

async function expectDirectory(directoryPath: string): Promise<void> {
  await access(directoryPath);
  const directoryEntry = await stat(directoryPath);

  expect(directoryEntry.isDirectory()).toBe(true);
}
