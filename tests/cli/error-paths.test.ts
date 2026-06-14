import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from './helpers.js';

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function makeProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-error-paths-'));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);
  return projectRoot;
}

async function scaffoldFeature(
  projectRoot: string,
  slug: string,
  status: string,
  files: Record<string, string> = {},
): Promise<void> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.scifi.json'),
    JSON.stringify({
      version: 1,
      slug,
      status,
      createdAt: '2026-05-21T00:00:00Z',
      updatedAt: '2026-05-21T00:00:00Z',
    }),
    'utf8',
  );
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(featureDir, name), contents, 'utf8');
  }
}

async function addDoneTask(projectRoot: string, slug: string): Promise<void> {
  const tasksDir = join(projectRoot, 'docs', 'scifi', 'specs', slug, 'tasks');
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, 'first.md'),
    '---\nid: TASK-001\nslug: first\nstatus: done\ndepends-on: []\n---\n# first\n',
    'utf8',
  );
}

async function addOpenFix(projectRoot: string, slug: string): Promise<void> {
  const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', slug, 'fixes');
  await mkdir(fixesDir, { recursive: true });
  await writeFile(
    join(fixesDir, 'FIX-0001-broken.md'),
    `---\nid: FIX-0001\nslug: broken\nstatus: open\nfeature: ${slug}\ncreated: 2026-05-21T00:00:00Z\n---\n# broken\n`,
    'utf8',
  );
}

describe('command error and branch paths', () => {
  it('list surfaces a structured error when a metadata file is corrupt', async () => {
    const projectRoot = await makeProject();
    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'broken');
    await mkdir(featureDir, { recursive: true });
    await writeFile(join(featureDir, '.scifi.json'), '{ not json', 'utf8');

    const result = await runCli(['list']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('INTERNAL');
  });

  it('list emits NDJSON rows when --json is passed', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'alpha', 'created');

    const result = await runCli(['list', '--json']);

    expect(result.exitCode).toBe(0);
    const rows = result.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(rows[0]).toMatchObject({ slug: 'alpha', status: 'created', openFixes: 0 });
  });

  it('list renders open-fix counts in the human table', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'alpha', 'in-progress');
    await addOpenFix(projectRoot, 'alpha');

    const result = await runCli(['list']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1 open fix');
  });

  it('spec reports a CONFLICT when the feature already exists', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'dup', 'created');

    const result = await runCli(['spec', 'dup']);

    expect(result.exitCode).toBe(5);
    expect(result.stderr).toContain('CONFLICT');
  });

  it('status reports NOT_FOUND for an unknown feature', async () => {
    await makeProject();

    const result = await runCli(['status', 'ghost']);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('task list surfaces an error when a task file is malformed', async () => {
    const projectRoot = await makeProject();
    const tasksDir = join(projectRoot, 'docs', 'scifi', 'specs', 'feat', 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(join(tasksDir, 'bad.md'), 'no frontmatter here\n', 'utf8');

    const result = await runCli(['task', 'list', 'feat']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('INTERNAL');
  });

  it('task start reports NOT_FOUND for a missing task', async () => {
    await makeProject();

    const result = await runCli(['task', 'start', 'feat', 'ghost']);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('plan reports an in-progress planning session', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'feat', 'spec-ready', {
      'spec.md': '# spec\n',
      'design.md': '# design\n',
    });

    const result = await runCli(['plan', 'feat']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Planning already started');
  });

  it('plan reports an already-planned feature', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'feat', 'plan-ready', {
      'spec.md': '# spec\n',
      'design.md': '# design\n',
    });
    await addDoneTask(projectRoot, 'feat');

    const result = await runCli(['plan', 'feat']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('already planned');
  });

  it('finish reports a single blocking fix using the singular wording', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'feat', 'in-progress');
    await addDoneTask(projectRoot, 'feat');
    await addOpenFix(projectRoot, 'feat');

    const result = await runCli(['finish', 'feat']);

    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain('1 open fix');
    expect(result.stderr).not.toContain('1 open fixes');
  });

  it('finish reports multiple blocking fixes using the plural wording', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'feat', 'in-progress');
    await addDoneTask(projectRoot, 'feat');
    const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'feat', 'fixes');
    await mkdir(fixesDir, { recursive: true });
    for (const n of [1, 2]) {
      await writeFile(
        join(fixesDir, `FIX-000${n}-x${n}.md`),
        `---\nid: FIX-000${n}\nslug: x${n}\nstatus: open\nfeature: feat\ncreated: 2026-05-21T00:00:00Z\n---\n# x${n}\n`,
        'utf8',
      );
    }

    const result = await runCli(['finish', 'feat']);

    expect(result.exitCode).toBe(4);
    expect(result.stderr).toContain('2 open fixes');
  });

  it('plan reports an in-progress session when design.md is missing but tasks exist', async () => {
    const projectRoot = await makeProject();
    await scaffoldFeature(projectRoot, 'feat', 'spec-ready', { 'spec.md': '# spec\n' });
    await addDoneTask(projectRoot, 'feat');

    const result = await runCli(['plan', 'feat']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Planning already started');
    expect(result.stdout).toContain('design.md: missing');
  });

  it('init maps an invalid harness id to a structured INVALID_ARGUMENT error', async () => {
    await makeProject();

    const result = await runCli(['init', '--harness', 'bogus', '--yes']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INVALID_ARGUMENT');
    expect(result.stderr).toContain('Available harnesses');
  });
});
