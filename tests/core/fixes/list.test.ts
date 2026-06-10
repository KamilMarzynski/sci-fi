import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeFixFile } from '../../../src/core/fixes/frontmatter.js';
import { findFixById, listFixes, listOpenFixes } from '../../../src/core/fixes/list.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

function makeFixContent(id: string, slug: string, status: string, feature: string): string {
  return `---\nid: ${id}\nslug: ${slug}\nstatus: ${status}\nfeature: ${feature}\ncreated: 2026-05-21T00:00:00.000Z\n---\n# ${slug}\n`;
}

async function scaffoldFixesDir(projectRoot: string, featureSlug: string): Promise<string> {
  const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', featureSlug, 'fixes');
  await mkdir(fixesDir, { recursive: true });
  return fixesDir;
}

describe('listFixes', () => {
  it('returns empty array when fixes/ dir does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-fixes-'));
    temporaryDirectories.push(projectRoot);
    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow');
    await mkdir(featureDir, { recursive: true });

    const fixes = await listFixes(projectRoot, 'auth-flow');
    expect(fixes).toEqual([]);
  });

  it('returns frontmatter for each .md file in fixes/', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-fixes-'));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, 'auth-flow');

    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      makeFixContent('FIX-0001', 'token-expiry', 'open', 'auth-flow'),
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0002-null-pointer.md'),
      makeFixContent('FIX-0002', 'null-pointer', 'resolved', 'auth-flow'),
      'utf8',
    );

    const fixes = await listFixes(projectRoot, 'auth-flow');
    expect(fixes).toHaveLength(2);
    const ids = fixes.map((f) => f.id).sort();
    expect(ids).toEqual(['FIX-0001', 'FIX-0002']);
  });

  it('ignores non-.md files', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-fixes-'));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, 'auth-flow');

    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      makeFixContent('FIX-0001', 'token-expiry', 'open', 'auth-flow'),
      'utf8',
    );
    await writeFile(join(fixesDir, 'notes.txt'), 'ignore me', 'utf8');

    const fixes = await listFixes(projectRoot, 'auth-flow');
    expect(fixes).toHaveLength(1);
  });
});

describe('listOpenFixes', () => {
  it('returns only open and in-progress fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-fixes-'));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, 'auth-flow');

    await writeFile(
      join(fixesDir, 'FIX-0001-open.md'),
      makeFixContent('FIX-0001', 'open', 'open', 'auth-flow'),
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0002-in-progress.md'),
      makeFixContent('FIX-0002', 'in-progress', 'in-progress', 'auth-flow'),
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0003-resolved.md'),
      makeFixContent('FIX-0003', 'resolved', 'resolved', 'auth-flow'),
      'utf8',
    );
    await writeFile(
      join(fixesDir, 'FIX-0004-wont-fix.md'),
      makeFixContent('FIX-0004', 'wont-fix', 'wont-fix', 'auth-flow'),
      'utf8',
    );

    const open = await listOpenFixes(projectRoot, 'auth-flow');
    expect(open).toHaveLength(2);
    const statuses = open.map((f) => f.status).sort();
    expect(statuses).toEqual(['in-progress', 'open']);
  });

  it('returns empty when all fixes are resolved or wont-fix', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-fixes-'));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, 'auth-flow');

    await writeFile(
      join(fixesDir, 'FIX-0001-resolved.md'),
      makeFixContent('FIX-0001', 'resolved', 'resolved', 'auth-flow'),
      'utf8',
    );

    const open = await listOpenFixes(projectRoot, 'auth-flow');
    expect(open).toEqual([]);
  });
});

describe('findFixById', () => {
  it('returns the file location and frontmatter for a matching id', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-findfix-'));
    temporaryDirectories.push(projectRoot);
    const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFixFile(join(fixesDir, 'FIX-0001-token-expiry.md'), {
      frontmatter: {
        id: 'FIX-0001',
        slug: 'token-expiry',
        status: 'open',
        feature: 'auth-flow',
        created: '2026-06-10T00:00:00Z',
      },
      body: '# token expiry\n',
    });

    const found = await findFixById(projectRoot, 'auth-flow', 'FIX-0001');
    expect(found?.frontmatter.slug).toBe('token-expiry');
    expect(found?.filePath).toContain('FIX-0001-token-expiry.md');
  });

  it('returns undefined when no fix matches the id', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-findfix-'));
    temporaryDirectories.push(projectRoot);
    const found = await findFixById(projectRoot, 'auth-flow', 'FIX-9999');
    expect(found).toBeUndefined();
  });
});
