import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildFeatureDirectoryPath,
  buildFeatureMetadataPath,
  createInitialFeatureMetadata,
} from '../../../src/core/specs/metadata.js';

describe('createInitialFeatureMetadata', () => {
  it('creates the initial metadata shape for a new feature', () => {
    const metadata = createInitialFeatureMetadata({
      id: 'FEAT-0001',
      slug: 'user-auth',
      title: 'User Auth',
      createdAt: '2026-05-20T06:29:55Z',
    });

    expect(metadata).toEqual({
      version: 1,
      id: 'FEAT-0001',
      slug: 'user-auth',
      title: 'User Auth',
      status: 'created',
      createdAt: '2026-05-20T06:29:55Z',
      updatedAt: '2026-05-20T06:29:55Z',
    });
  });
});

describe('feature path helpers', () => {
  it('places scifi-managed features under docs/scifi/specs', () => {
    const projectRoot = '/repo';

    expect(buildFeatureDirectoryPath(projectRoot, 'user-auth')).toBe(
      join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth'),
    );
    expect(buildFeatureMetadataPath(projectRoot, 'user-auth')).toBe(
      join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth', '.scifi.json'),
    );
  });
});
