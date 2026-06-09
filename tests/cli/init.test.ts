import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';
import { runCli } from './helpers.js';

describe('specflow init', () => {
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
    const projectRoot = mkdtempSync(join(tmpdir(), 'specflow-init-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await buildProgram().parseAsync([
      'node',
      'specflow',
      'init',
      '--harness',
      'claude-code',
      '--yes',
    ]);

    await expectDirectory(join(projectRoot, 'docs', 'specflow', '.specflow'));
    await expectDirectory(join(projectRoot, 'docs', 'specflow', 'specs'));
    await expectDirectory(join(projectRoot, 'docs', 'specflow', 'bugs'));
    expect(readFileSync(join(projectRoot, 'docs', 'specflow', 'EVALUATION.md'), 'utf8')).toBe(
      expectedEvaluationDocument,
    );
    await expect(access(join(projectRoot, 'docs', 'specflow', 'ROADMAP.md'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
  });

  it('fails without partial writes when a bootstrap doc path conflicts', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'specflow-init-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'specflow', 'EVALUATION.md'), {
      recursive: true,
    });

    const run = await runCli(['init', '--harness', 'claude-code', '--yes']);
    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain(
      `${join('docs', 'specflow', 'EVALUATION.md')}: path exists and is not a regular file.`,
    );

    await expect(access(join(projectRoot, 'docs', 'specflow', '.specflow'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(projectRoot, 'docs', 'specflow', 'specs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(projectRoot, 'docs', 'specflow', 'bugs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('fails without partial writes when a scaffold directory path conflicts', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'specflow-init-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, 'docs', 'specflow'), { recursive: true });
    writeFileSync(join(projectRoot, 'docs', 'specflow', '.specflow'), 'conflict', 'utf8');

    const run = await runCli(['init', '--harness', 'claude-code', '--yes']);
    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain(
      `${join('docs', 'specflow', '.specflow')}: path exists and is not a directory.`,
    );

    expect(readFileSync(join(projectRoot, 'docs', 'specflow', '.specflow'), 'utf8')).toBe(
      'conflict',
    );
    await expect(access(join(projectRoot, 'docs', 'specflow', 'specs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(projectRoot, 'docs', 'specflow', 'bugs'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(
      access(join(projectRoot, 'docs', 'specflow', 'EVALUATION.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(join(projectRoot, 'docs', 'specflow', 'ROADMAP.md'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
  });
});

const expectedEvaluationDocument = `# EVALUATION.md

Evaluation is a release gate for this repository.

## Required Checks

- Run targeted tests for the module you changed.
- Add filesystem-level coverage for scaffolding and generated output.
- Verify command behavior end to end once CLI wiring exists.

## Verification Notes

- Prefer deterministic tests over mocks for file generation.
- Inspect generated files for meaningful content, not only existence.
- Record any skipped verification so the gap is explicit.
`;

async function expectDirectory(directoryPath: string): Promise<void> {
  await access(directoryPath);
  const directoryEntry = await stat(directoryPath);

  expect(directoryEntry.isDirectory()).toBe(true);
}
