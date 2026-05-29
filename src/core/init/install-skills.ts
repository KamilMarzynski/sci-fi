import { join } from "node:path";
import { loadCatalog } from "../skills/catalog.js";
import "../skills/harness/register-defaults.js";
import type { HarnessId } from "../skills/harness/adapter.js";
import { getAdapter } from "../skills/harness/registry.js";

export interface InstallSkillsOptions {
  readonly projectRoot: string;
  readonly harness: HarnessId;
  readonly packageRoot: string;
}

export async function installSkills(
  options: InstallSkillsOptions,
): Promise<void> {
  const adapter = getAdapter(options.harness);
  const bundles = await loadCatalog({
    bodiesRoot: join(options.packageRoot, "skills"),
    manifestsRoot: join(options.packageRoot, "dist", "skills"),
  });

  await adapter.install(bundles, options.projectRoot);
}
