import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledCommand,
} from './installed-test-helpers.js';

describe('installed build worktree-aware discovery', () => {
  it('discovers features from linked worktrees and reports their locations', () => {
    const installation = createInstalledPackageTestEnvironment('installed-worktree-discovery-');

    try {
      const dir = installation.installDirectory;
      const worktreeRoot = join(dir, '.worktrees', 'feat-worktree-only');

      execFileSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], {
        cwd: dir,
        encoding: 'utf8',
      });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir, encoding: 'utf8' });

      writeFileSync(join(dir, '.gitignore'), 'node_modules/\n', 'utf8');

      const localFeatureDir = join(dir, 'docs', 'scifi', 'specs', 'local-feature');
      mkdirSync(localFeatureDir, { recursive: true });
      writeFileSync(
        join(localFeatureDir, '.scifi.json'),
        `${JSON.stringify(
          {
            version: 1,
            slug: 'local-feature',
            title: 'Local Feature',
            status: 'created',
            createdAt: '2026-06-15T00:00:00Z',
            updatedAt: '2026-06-15T00:00:00Z',
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      execFileSync('git', ['add', '.'], { cwd: dir, encoding: 'utf8' });
      execFileSync('git', ['commit', '-m', 'initial'], { cwd: dir, encoding: 'utf8' });

      execFileSync('git', ['worktree', 'add', '-b', 'feat/worktree-only', worktreeRoot], {
        cwd: dir,
        encoding: 'utf8',
      });

      const worktreeFeatureDir = join(worktreeRoot, 'docs', 'scifi', 'specs', 'worktree-only');
      mkdirSync(worktreeFeatureDir, { recursive: true });
      writeFileSync(
        join(worktreeFeatureDir, '.scifi.json'),
        `${JSON.stringify(
          {
            version: 1,
            slug: 'worktree-only',
            title: 'Worktree Only Feature',
            status: 'spec-ready',
            createdAt: '2026-06-15T00:00:00Z',
            updatedAt: '2026-06-15T00:00:00Z',
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      writeFileSync(join(worktreeFeatureDir, 'spec.md'), '# Worktree Only Spec\n', 'utf8');

      const listResult = runInstalledCommand(dir, ['list']);
      expect(listResult.status).toBe(0);
      expect(listResult.stderr).toBe('');

      const listLines = listResult.stdout.split('\n').filter((line) => line.length > 0);
      const localLine = listLines.find((line) => line.includes('local-feature'));
      const worktreeLine = listLines.find((line) => line.includes('worktree-only'));
      expect(localLine).toBeDefined();
      expect(worktreeLine).toBeDefined();

      const expectedWorktreeLocation = `worktree:${realpathSync(worktreeRoot)}`;
      expect(localLine?.split('\t')).toContain('local');
      expect(worktreeLine?.split('\t')).toContain(expectedWorktreeLocation);
      expect(worktreeLine?.split('\t')[2]).toBe('-');

      const statusResult = runInstalledCommand(dir, ['status', 'worktree-only', '--json']);
      expect(statusResult.status).toBe(0);
      expect(statusResult.stderr).toBe('');

      const statusEnvelope: unknown = JSON.parse(statusResult.stdout);
      if (typeof statusEnvelope !== 'object' || statusEnvelope === null) {
        throw new Error(`Expected status JSON to be an object, got ${statusResult.stdout}`);
      }
      if (!Reflect.has(statusEnvelope, 'ok') || Reflect.get(statusEnvelope, 'ok') !== true) {
        throw new Error(`Expected status JSON ok to be true, got ${statusResult.stdout}`);
      }

      const statusJson = Reflect.get(statusEnvelope, 'data');
      if (typeof statusJson !== 'object' || statusJson === null) {
        throw new Error(`Expected status JSON data to be an object, got ${statusResult.stdout}`);
      }

      expect(Reflect.get(statusJson, 'slug')).toBe('worktree-only');
      expect(Reflect.get(statusJson, 'status')).toBe('spec-ready');
      expect(Reflect.get(statusJson, 'location')).toBe(expectedWorktreeLocation);
      expect(Reflect.get(statusJson, 'title')).toBe('Worktree Only Feature');

      const artifacts = Reflect.get(statusJson, 'artifacts');
      if (typeof artifacts !== 'object' || artifacts === null) {
        throw new Error(
          `Expected status JSON artifacts to be an object, got ${statusResult.stdout}`,
        );
      }
      expect(Reflect.get(artifacts, 'spec')).toBe(true);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
});
