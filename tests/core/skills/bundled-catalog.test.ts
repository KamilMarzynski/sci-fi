import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../../../src/core/skills/catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..', '..');

describe('bundled skill catalog', () => {
  it('loads exactly 13 skills with matching ids', async () => {
    const bundles = await loadCatalog({
      bodiesRoot: join(packageRoot, 'skills'),
      manifestsRoot: join(packageRoot, 'dist', 'skills'),
    });

    const ids = bundles.map((bundle) => bundle.manifest.id).sort();

    expect(ids).toEqual([
      'sf-bug',
      'sf-change',
      'sf-code-review',
      'sf-continue',
      'sf-feature',
      'sf-fix',
      'sf-implement',
      'sf-plan',
      'sf-plan-review',
      'sf-receiving-review',
      'sf-spec-review',
      'sf-tdd',
      'sf-verification',
    ]);
  });
});
