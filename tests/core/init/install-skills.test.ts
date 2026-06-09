import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { installSkills } from '../../../src/core/init/install-skills.js';
import { HarnessNotImplementedError } from '../../../src/core/skills/harness/adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..', '..');

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

describe('installSkills', () => {
  it('installs all 11 bundled skills to the claude-code targets', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    await installSkills({
      projectRoot,
      harness: 'claude-code',
      packageRoot,
    });

    for (const id of [
      'sf-feature',
      'sf-plan',
      'sf-fix',
      'sf-bug',
      'sf-change',
      'sf-implement',
      'sf-spec-review',
      'sf-plan-review',
      'sf-code-review',
      'sf-verification',
      'sf-tdd',
    ]) {
      expect(existsSync(join(projectRoot, '.claude', 'skills', id, 'SKILL.md'))).toBe(true);
    }
  });

  it('throws HarnessNotImplementedError for opencode without writing anything', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    await expect(
      installSkills({ projectRoot, harness: 'opencode', packageRoot }),
    ).rejects.toThrowError(HarnessNotImplementedError);

    expect(existsSync(join(projectRoot, '.claude'))).toBe(false);
  });
});
