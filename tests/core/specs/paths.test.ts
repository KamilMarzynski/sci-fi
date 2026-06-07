import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildFeatureDirectoryPath,
  buildFeatureMetadataPath,
  buildFeaturesRootPath,
} from '../../../src/core/specs/paths.js';

describe('spec path helpers', () => {
  it('builds features root path', () => {
    expect(buildFeaturesRootPath('/repo')).toBe(join('/repo', 'docs', 'specflow', 'specs'));
  });

  it('builds feature directory path', () => {
    expect(buildFeatureDirectoryPath('/repo', 'user-auth')).toBe(
      join('/repo', 'docs', 'specflow', 'specs', 'user-auth'),
    );
  });

  it('builds feature metadata path', () => {
    expect(buildFeatureMetadataPath('/repo', 'user-auth')).toBe(
      join('/repo', 'docs', 'specflow', 'specs', 'user-auth', '.specflow.json'),
    );
  });

  it('rejects path traversal in feature slug', () => {
    expect(() => buildFeatureDirectoryPath('/repo', '../../../etc')).toThrow(
      'Invalid feature slug "../../../etc"',
    );
  });

  it('rejects absolute path in feature slug', () => {
    expect(() => buildFeatureDirectoryPath('/repo', '/etc/passwd')).toThrow(
      'Invalid feature slug "/etc/passwd"',
    );
  });
});
