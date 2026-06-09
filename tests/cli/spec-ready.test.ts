import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';
import { runCli } from './helpers.js';

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('spec-ready command', () => {
  it('transitions feature to spec-ready when spec.md exists', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-spec-ready-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          status: 'created',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');

    await buildProgram().parseAsync(['node', 'scifi', 'spec-ready', 'user-auth']);

    const metadata = JSON.parse(await readFile(join(featureDir, '.scifi.json'), 'utf8')) as {
      status: string;
    };
    expect(metadata.status).toBe('spec-ready');
  });

  it('fails when spec.md is missing', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-spec-ready-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          status: 'created',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const run = await runCli(['spec-ready', 'user-auth']);
    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('spec.md is missing');
    expect(run.stderr).toContain('PRECONDITION_FAILED');
  });

  it('emits structured JSON on success with --json', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-spec-ready-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          status: 'created',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');

    const run = await runCli(['spec-ready', 'user-auth', '--json']);
    expect(run.exitCode).toBe(0);
    const payload = JSON.parse(run.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.data).toMatchObject({
      action: 'spec-ready',
      id: 'FEAT-0001',
      slug: 'user-auth',
      previousStatus: 'created',
      newStatus: 'spec-ready',
    });
  });
});
