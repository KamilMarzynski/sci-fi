import { join } from 'node:path';
import { loadCatalog } from '../skills/catalog.js';
import '../skills/harness/register-defaults.js';
import type { HarnessId } from '../skills/harness/adapter.js';
import { getAdapter } from '../skills/harness/registry.js';

export interface InstalledEntry {
  readonly harness: HarnessId;
  readonly baseDir: string;
  readonly skills: string[];
}

export interface FailedEntry {
  readonly harness: HarnessId;
  readonly error: Error;
}

export interface InstallReport {
  readonly installed: InstalledEntry[];
  readonly failed: FailedEntry[];
}

export interface InstallSkillsOptions {
  readonly projectRoot: string;
  readonly harnesses: readonly HarnessId[];
  readonly packageRoot: string;
}

export async function installSkills(options: InstallSkillsOptions): Promise<InstallReport> {
  const bundles = await loadCatalog({
    bodiesRoot: join(options.packageRoot, 'skills'),
    manifestsRoot: join(options.packageRoot, 'dist', 'skills'),
  });

  const installed: InstalledEntry[] = [];
  const failed: FailedEntry[] = [];

  for (const harness of options.harnesses) {
    const adapter = getAdapter(harness);
    try {
      await adapter.install(bundles, options.projectRoot);
      installed.push({
        harness,
        baseDir: adapter.skillsBaseDir,
        skills: bundles.map((bundle) => bundle.manifest.id),
      });
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      failed.push({ harness, error });
    }
  }

  return { installed, failed };
}
