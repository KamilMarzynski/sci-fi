import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFixFile, writeFixFile } from '../../../src/core/fixes/frontmatter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('writeFixFile / readFixFile', () => {
  it('round-trips a fix file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scifi-fix-fm-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'FIX-0001-token-expiry.md');

    await writeFixFile(filePath, {
      frontmatter: {
        id: 'FIX-0001',
        slug: 'token-expiry',
        status: 'open',
        feature: 'auth-flow',
        created: '2026-05-21T00:00:00.000Z',
      },
      body: '# token expiry\n',
    });

    const result = await readFixFile(filePath);
    expect(result.frontmatter.id).toBe('FIX-0001');
    expect(result.frontmatter.slug).toBe('token-expiry');
    expect(result.frontmatter.status).toBe('open');
    expect(result.frontmatter.feature).toBe('auth-flow');
    expect(result.frontmatter.created).toBe('2026-05-21T00:00:00.000Z');
    expect(result.body).toBe('# token expiry\n');
  });

  it('throws on missing frontmatter', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scifi-fix-fm-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'bad.md');
    await writeFile(filePath, 'no frontmatter\n', 'utf8');

    await expect(readFixFile(filePath)).rejects.toThrow('missing YAML frontmatter');
  });

  it('reads a legacy in-progress fix as open', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scifi-fix-fm-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'FIX-0001-legacy.md');

    await writeFile(
      filePath,
      '---\nid: FIX-0001\nslug: legacy\nstatus: in-progress\nfeature: auth-flow\ncreated: 2026-05-21T00:00:00.000Z\n---\n# legacy\n',
      'utf8',
    );

    const result = await readFixFile(filePath);
    expect(result.frontmatter.status).toBe('open');
  });

  it('throws when frontmatter is invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scifi-fix-fm-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'bad.md');

    await writeFile(filePath, '---\nfoo: bar\n---\nbody\n', 'utf8');

    await expect(readFixFile(filePath)).rejects.toThrow('invalid frontmatter');
  });
});
