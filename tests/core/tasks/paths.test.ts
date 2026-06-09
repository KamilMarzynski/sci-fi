import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTaskFilePath, buildTasksDirectoryPath } from '../../../src/core/tasks/paths.js';

describe('task path helpers', () => {
  it('places tasks/ under the feature directory', () => {
    expect(buildTasksDirectoryPath('/repo', 'user-auth')).toBe(
      join('/repo', 'docs', 'scifi', 'specs', 'user-auth', 'tasks'),
    );
  });

  it('builds task file path from task slug', () => {
    expect(buildTaskFilePath('/repo', 'user-auth', 'setup-database')).toBe(
      join('/repo', 'docs', 'scifi', 'specs', 'user-auth', 'tasks', 'setup-database.md'),
    );
  });

  it('rejects path traversal in feature slug', () => {
    expect(() => buildTasksDirectoryPath('/repo', '../../../etc')).toThrow(
      'Invalid feature slug "../../../etc"',
    );
  });

  it('rejects path traversal in task slug', () => {
    expect(() => buildTaskFilePath('/repo', 'user-auth', '../../../evil')).toThrow(
      'Invalid task slug "../../../evil"',
    );
  });
});
