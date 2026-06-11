import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';
import { runCli } from './helpers.js';

describe('scifi init — multi-harness', () => {
  const temporaryDirectories: string[] = [];
  const originalWorkingDirectory = process.cwd();

  afterEach(async () => {
    process.chdir(originalWorkingDirectory);

    await Promise.all(
      temporaryDirectories.map(async (directory) => {
        await rm(directory, { force: true, recursive: true });
      }),
    );
    temporaryDirectories.length = 0;
  });

  it('installs both harnesses when --harness is repeated', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-multi-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(['init', '--harness', 'claude-code', '--harness', 'cursor', '--yes']);

    expect(run.exitCode).toBe(0);

    await expectDirectory(join(projectRoot, '.claude', 'skills'));
    await expectDirectory(join(projectRoot, '.cursor', 'skills'));

    const config: unknown = JSON.parse(
      readFileSync(join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'), 'utf8'),
    );
    expect(config).toMatchObject({ harnesses: ['claude-code', 'cursor'] });
  });

  it('installs only claude-code when --yes is given with no --harness flags', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-yes-default-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(['init', '--yes']);

    expect(run.exitCode).toBe(0);

    await expectDirectory(join(projectRoot, '.claude', 'skills'));

    const config: unknown = JSON.parse(
      readFileSync(join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'), 'utf8'),
    );
    expect(config).toMatchObject({ harnesses: ['claude-code'] });
  });

  it('exits non-zero with INVALID_ARGUMENT when non-interactive with no --harness and no --yes', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-noarg-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(['init']);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain('INVALID_ARGUMENT');
  });

  it('deduplicates repeated --harness flags and installs each once', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-dedup-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(['init', '--harness', 'cursor', '--harness', 'cursor', '--yes']);

    expect(run.exitCode).toBe(0);

    await expectDirectory(join(projectRoot, '.cursor', 'skills'));

    const config: unknown = JSON.parse(
      readFileSync(join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'), 'utf8'),
    );
    expect(config).toMatchObject({ harnesses: ['cursor'] });
  });

  it('exits zero and names the failed harness when one of several harnesses fails', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-partial-fail-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    // Make the cursor skills target unwritable by placing a file where the dir should be
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    writeFileSync(join(projectRoot, '.cursor', 'skills'), 'block', 'utf8');

    const run = await runCli(['init', '--harness', 'claude-code', '--harness', 'cursor', '--yes']);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('Failed:  cursor');
    await expectDirectory(join(projectRoot, '.claude', 'skills'));
  });

  it('exits non-zero when all selected harnesses fail', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-all-fail-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    // Block cursor install
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    writeFileSync(join(projectRoot, '.cursor', 'skills'), 'block', 'utf8');

    const run = await runCli(['init', '--harness', 'cursor', '--yes']);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain('cursor');
  });

  it('lists installed harnesses and locations in success output', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-output-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(['init', '--harness', 'claude-code', '--harness', 'cursor', '--yes']);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('claude-code');
    expect(run.stdout).toContain('cursor');
    expect(run.stdout).toContain('.claude/skills');
    expect(run.stdout).toContain('.cursor/skills');
  });

  it('emits harnesses array in JSON success payload', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-json-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli([
      'init',
      '--harness',
      'claude-code',
      '--harness',
      'cursor',
      '--yes',
      '--json',
    ]);

    expect(run.exitCode).toBe(0);
    const parsed: unknown = JSON.parse(run.stdout);
    expect(parsed).toMatchObject({
      ok: true,
      data: {
        harnesses: [
          { harness: expect.any(String), baseDir: expect.any(String), skills: expect.any(Array) },
          { harness: expect.any(String), baseDir: expect.any(String), skills: expect.any(Array) },
        ],
      },
    });
  });
});

describe('scifi init', () => {
  const temporaryDirectories: string[] = [];
  const originalWorkingDirectory = process.cwd();

  afterEach(async () => {
    process.chdir(originalWorkingDirectory);

    await Promise.all(
      temporaryDirectories.map(async (directory) => {
        await rm(directory, { force: true, recursive: true });
      }),
    );
    temporaryDirectories.length = 0;
  });

  it('creates the baseline project structure in the current working directory', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await buildProgram().parseAsync(['node', 'scifi', 'init', '--harness', 'claude-code', '--yes']);

    await expectDirectory(join(projectRoot, 'docs', 'scifi', '.scifi'));
    await expectDirectory(join(projectRoot, 'docs', 'scifi', 'specs'));
    expect(readFileSync(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), 'utf8')).toContain(
      '# CONTEXT.md',
    );
    await expect(access(join(projectRoot, 'docs', 'scifi', 'EVALUATION.md'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
    await expect(access(join(projectRoot, 'docs', 'scifi', 'ROADMAP.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('fails without partial writes when a bootstrap doc path conflicts', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'), {
      recursive: true,
    });

    const run = await runCli(['init', '--harness', 'claude-code', '--yes']);
    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain(
      `${join('docs', 'scifi', 'CONTEXT.md')}: path exists and is not a regular file.`,
    );

    await expect(access(join(projectRoot, 'docs', 'scifi', '.scifi'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(projectRoot, 'docs', 'scifi', 'specs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('fails without partial writes when a scaffold directory path conflicts', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-init-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'scifi'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'scifi', '.scifi'), 'conflict', 'utf8');

    const run = await runCli(['init', '--harness', 'claude-code', '--yes']);
    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain(
      `${join('docs', 'scifi', '.scifi')}: path exists and is not a directory.`,
    );

    expect(readFileSync(join(projectRoot, 'docs', 'scifi', '.scifi'), 'utf8')).toBe('conflict');
    await expect(access(join(projectRoot, 'docs', 'scifi', 'specs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(projectRoot, 'docs', 'scifi', 'CONTEXT.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(projectRoot, 'docs', 'scifi', 'ROADMAP.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

async function expectDirectory(directoryPath: string): Promise<void> {
  await access(directoryPath);
  const directoryEntry = await stat(directoryPath);

  expect(directoryEntry.isDirectory()).toBe(true);
}
