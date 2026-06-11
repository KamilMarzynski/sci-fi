import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installSkills } from '../../../src/core/init/install-skills.js';
import * as catalogModule from '../../../src/core/skills/catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..', '..');

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
  vi.restoreAllMocks();
});

const ALL_SKILL_IDS = [
  'sf-feature',
  'sf-plan',
  'sf-fix',
  'sf-bug',
  'sf-change',
  'sf-implement',
  'sf-spec-review',
  'sf-plan-review',
  'sf-code-review',
  'sf-handover',
  'sf-tdd',
];

describe('installSkills', () => {
  it('returns installed entry per harness and empty failed when all succeed', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    const report = await installSkills({
      projectRoot,
      harnesses: ['claude-code', 'opencode'],
      packageRoot,
    });

    expect(report.failed).toHaveLength(0);
    expect(report.installed).toHaveLength(2);

    const claudeEntry = report.installed.find((e) => e.harness === 'claude-code');
    const opencodeEntry = report.installed.find((e) => e.harness === 'opencode');

    expect(claudeEntry).toBeDefined();
    expect(opencodeEntry).toBeDefined();

    expect(claudeEntry?.baseDir).toBe('.claude/skills');
    expect(opencodeEntry?.baseDir).toBe('.opencode/skills');

    expect(claudeEntry?.skills).toEqual(expect.arrayContaining(ALL_SKILL_IDS));
    expect(opencodeEntry?.skills).toEqual(expect.arrayContaining(ALL_SKILL_IDS));

    // Verify files were actually written
    for (const id of ALL_SKILL_IDS) {
      expect(existsSync(join(projectRoot, '.claude', 'skills', id, 'SKILL.md'))).toBe(true);
      expect(existsSync(join(projectRoot, '.opencode', 'skills', id, 'SKILL.md'))).toBe(true);
    }
  });

  it('puts failing harness in failed and still installs the others', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    // Block claude-code installation by placing a plain file where the skills dir must be.
    // mkdir({ recursive: true }) on a path whose ancestor is a file → ENOTDIR → real Error.
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'skills'), 'blocker');

    const report = await installSkills({
      projectRoot,
      harnesses: ['claude-code', 'opencode'],
      packageRoot,
    });

    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.harness).toBe('claude-code');
    expect(report.failed[0]?.error).toBeInstanceOf(Error);

    expect(report.installed).toHaveLength(1);
    expect(report.installed[0]?.harness).toBe('opencode');

    // opencode files should still be written
    for (const id of ALL_SKILL_IDS) {
      expect(existsSync(join(projectRoot, '.opencode', 'skills', id, 'SKILL.md'))).toBe(true);
    }
  });

  it('returns empty installed and all harnesses in failed when every harness fails', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    // Block both harness skill dirs
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    writeFileSync(join(projectRoot, '.claude', 'skills'), 'blocker');
    mkdirSync(join(projectRoot, '.opencode'), { recursive: true });
    writeFileSync(join(projectRoot, '.opencode', 'skills'), 'blocker');

    const report = await installSkills({
      projectRoot,
      harnesses: ['claude-code', 'opencode'],
      packageRoot,
    });

    expect(report.installed).toHaveLength(0);
    expect(report.failed).toHaveLength(2);
    expect(report.failed.map((f) => f.harness)).toEqual(
      expect.arrayContaining(['claude-code', 'opencode']),
    );
    for (const f of report.failed) {
      expect(f.error).toBeInstanceOf(Error);
    }
  });

  it('loads the catalog exactly once regardless of harness count', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    const loadCatalogSpy = vi.spyOn(catalogModule, 'loadCatalog');

    await installSkills({
      projectRoot,
      harnesses: ['claude-code', 'opencode'],
      packageRoot,
    });

    expect(loadCatalogSpy).toHaveBeenCalledTimes(1);
  });

  // Backwards-compat: single harness still works (used by init.ts adapter call)
  it('installs all bundled skills to the claude-code target (single harness)', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    const report = await installSkills({
      projectRoot,
      harnesses: ['claude-code'],
      packageRoot,
    });

    expect(report.failed).toHaveLength(0);
    expect(report.installed).toHaveLength(1);

    for (const id of ALL_SKILL_IDS) {
      expect(existsSync(join(projectRoot, '.claude', 'skills', id, 'SKILL.md'))).toBe(true);
    }
  });

  it('installs all bundled skills to the opencode target (single harness)', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-install-'));
    temporaryDirectories.push(projectRoot);

    const report = await installSkills({
      projectRoot,
      harnesses: ['opencode'],
      packageRoot,
    });

    expect(report.failed).toHaveLength(0);
    expect(report.installed).toHaveLength(1);

    for (const id of ALL_SKILL_IDS) {
      expect(existsSync(join(projectRoot, '.opencode', 'skills', id, 'SKILL.md'))).toBe(true);
    }
  });
});
