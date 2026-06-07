import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFeature } from '../../../src/core/specs/create.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
  temporaryDirectories.length = 0;
});

describe('createFeature', () => {
  it('creates a feature folder with only .specflow.json', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-create-'));
    temporaryDirectories.push(projectRoot);

    const result = await createFeature({
      projectRoot,
      slug: 'user-auth',
      title: 'User Auth',
      now: '2026-05-20T06:29:55Z',
    });

    expect(result.featureDirectoryPath).toBe(
      join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth'),
    );
    expect(result.metadataPath).toBe(
      join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', '.specflow.json'),
    );

    const metadataContents = JSON.parse(await readFile(result.metadataPath, 'utf8'));

    expect(metadataContents.status).toBe('created');
    await expect(stat(join(result.featureDirectoryPath, 'spec.md'))).rejects.toThrow();
    await expect(stat(join(result.featureDirectoryPath, 'architecture.md'))).rejects.toThrow();
    await expect(stat(join(result.featureDirectoryPath, 'tasks'))).rejects.toThrow();
  });

  it('fails when the feature directory already exists', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-create-'));
    temporaryDirectories.push(projectRoot);

    await createFeature({
      projectRoot,
      slug: 'user-auth',
      now: '2026-05-20T06:29:55Z',
    });

    await expect(
      createFeature({
        projectRoot,
        slug: 'user-auth',
        now: '2026-05-20T06:30:55Z',
      }),
    ).rejects.toThrow(
      `Cannot create feature user-auth: ${join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth')} already exists.`,
    );
  });

  it('assigns sequential ids', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-create-'));
    temporaryDirectories.push(projectRoot);

    const first = await createFeature({
      projectRoot,
      slug: 'first-feature',
      now: '2026-05-20T06:29:55Z',
    });

    const second = await createFeature({
      projectRoot,
      slug: 'second-feature',
      now: '2026-05-20T06:30:55Z',
    });

    expect(first.id).toBe('FEAT-0001');
    expect(second.id).toBe('FEAT-0002');
  });

  it('omits title when not provided', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-create-'));
    temporaryDirectories.push(projectRoot);

    const result = await createFeature({
      projectRoot,
      slug: 'no-title',
      now: '2026-05-20T06:29:55Z',
    });

    const metadata = JSON.parse(await readFile(result.metadataPath, 'utf8'));
    expect(metadata).not.toHaveProperty('title');
  });
});
