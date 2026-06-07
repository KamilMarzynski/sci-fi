import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledCommand,
} from './installed-test-helpers.js';

describe('installed build lifecycle verification', () => {
  it('drives a feature from created through done via installed binary', () => {
    const installation = createInstalledPackageTestEnvironment('installed-lifecycle-');

    try {
      const dir = installation.installDirectory;

      // Create feature
      let result = runInstalledCommand(dir, ['spec', 'user-auth', '--title', 'User Auth']);
      expect(result.status).toBe(0);

      const featureDir = join(dir, 'docs', 'specflow', 'specs', 'user-auth');
      expect(existsSync(join(featureDir, '.specflow.json'))).toBe(true);

      // Write spec.md then mark spec-ready
      writeFileSync(join(featureDir, 'spec.md'), '# User Auth Spec\n', 'utf8');
      result = runInstalledCommand(dir, ['spec-ready', 'user-auth']);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      let metadata = JSON.parse(readFileSync(join(featureDir, '.specflow.json'), 'utf8')) as {
        status: string;
      };
      expect(metadata.status).toBe('spec-ready');

      // Write architecture.md and a task, then mark plan-ready
      writeFileSync(join(featureDir, 'architecture.md'), '# Architecture\n', 'utf8');
      const tasksDir = join(featureDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(
        join(tasksDir, 'setup-db.md'),
        '---\nid: TASK-001\nslug: setup-db\nstatus: pending\ndepends-on: []\n---\n# Setup DB\n',
        'utf8',
      );

      result = runInstalledCommand(dir, ['plan-ready', 'user-auth']);
      expect(result.status).toBe(0);
      metadata = JSON.parse(readFileSync(join(featureDir, '.specflow.json'), 'utf8')) as {
        status: string;
      };
      expect(metadata.status).toBe('plan-ready');

      // Start implementation
      result = runInstalledCommand(dir, ['start', 'user-auth']);
      expect(result.status).toBe(0);
      metadata = JSON.parse(readFileSync(join(featureDir, '.specflow.json'), 'utf8')) as {
        status: string;
      };
      expect(metadata.status).toBe('in-progress');

      // Start and complete the task
      result = runInstalledCommand(dir, ['task', 'start', 'user-auth', 'setup-db']);
      expect(result.status).toBe(0);

      result = runInstalledCommand(dir, ['task', 'done', 'user-auth', 'setup-db']);
      expect(result.status).toBe(0);

      // Finish the feature
      result = runInstalledCommand(dir, ['finish', 'user-auth']);
      expect(result.status).toBe(0);
      metadata = JSON.parse(readFileSync(join(featureDir, '.specflow.json'), 'utf8')) as {
        status: string;
      };
      expect(metadata.status).toBe('done');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('fails spec-ready when spec.md is missing from installed binary', () => {
    const installation = createInstalledPackageTestEnvironment('installed-lifecycle-err-');

    try {
      const dir = installation.installDirectory;

      runInstalledCommand(dir, ['spec', 'user-auth']);

      const result = runInstalledCommand(dir, ['spec-ready', 'user-auth']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('spec.md is missing');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
});
