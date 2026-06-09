import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('status command', () => {
  it('prints lifecycle snapshot for a feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth');
    const tasksDir = join(featureDir, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(featureDir, '.specflow.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          title: 'User Auth',
          status: 'in-progress',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: done\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'specflow', 'status', 'user-auth']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('user-auth');
    expect(combined).toContain('in-progress');
    expect(combined).toContain('spec.md');
    expect(combined).toContain('design.md');
    expect(combined).toContain('setup-db');
    expect(combined).toContain('done');
  });

  it('prints fixes block when feature has open fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth');
    const fixesDir = join(featureDir, 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFile(
      join(featureDir, '.specflow.json'),
      JSON.stringify({
        version: 1,
        id: 'FEAT-0001',
        slug: 'user-auth',
        status: 'in-progress',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
      }),
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      '---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n',
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0002-null-ptr.md'),
      '---\nid: FIX-0002\nslug: null-ptr\nstatus: in-progress\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# null ptr\n',
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'specflow', 'status', 'user-auth']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).toContain('fixes:');
    expect(combined).toContain('FIX-0001');
    expect(combined).toContain('token-expiry');
    expect(combined).toContain('FIX-0002');
    expect(combined).toContain('null-ptr');
  });

  it('omits fixes block when feature has no fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-status-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.specflow.json'),
      JSON.stringify({
        version: 1,
        id: 'FEAT-0001',
        slug: 'user-auth',
        status: 'in-progress',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
      }),
      'utf8',
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(['node', 'specflow', 'status', 'user-auth']);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join('');
    expect(combined).not.toContain('fixes:');
  });
});
