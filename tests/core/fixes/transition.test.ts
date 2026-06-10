import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFixFile, writeFixFile } from '../../../src/core/fixes/frontmatter.js';
import { updateFixStatus } from '../../../src/core/fixes/transition.js';
import type { FixStatus } from '../../../src/core/fixes/types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function createFixFile(projectRoot: string, status: FixStatus): Promise<void> {
  const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes');
  await mkdir(fixesDir, { recursive: true });
  await writeFixFile(join(fixesDir, 'FIX-0001-token-expiry.md'), {
    frontmatter: {
      id: 'FIX-0001',
      slug: 'token-expiry',
      status,
      feature: 'auth-flow',
      created: '2026-06-10T00:00:00Z',
    },
    body: '# token expiry\n',
  });
}

describe('updateFixStatus', () => {
  it('transitions an open fix to resolved and preserves the body', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'open');

    const result = await updateFixStatus(projectRoot, 'auth-flow', 'FIX-0001', 'resolved');

    expect(result.previousStatus).toBe('open');
    expect(result.newStatus).toBe('resolved');
    const file = await readFixFile(
      join(projectRoot, 'docs', 'scifi', 'specs', 'auth-flow', 'fixes', 'FIX-0001-token-expiry.md'),
    );
    expect(file.frontmatter.status).toBe('resolved');
    expect(file.body).toContain('# token expiry');
  });

  it('transitions an in-progress fix to wont-fix', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'in-progress');

    const result = await updateFixStatus(projectRoot, 'auth-flow', 'FIX-0001', 'wont-fix');
    expect(result.newStatus).toBe('wont-fix');
  });

  it('throws NOT_FOUND when the fix id does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'open');

    await expect(
      updateFixStatus(projectRoot, 'auth-flow', 'FIX-9999', 'resolved'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws PRECONDITION_FAILED when the fix is already resolved', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-fix-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFixFile(projectRoot, 'resolved');

    await expect(
      updateFixStatus(projectRoot, 'auth-flow', 'FIX-0001', 'resolved'),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});
