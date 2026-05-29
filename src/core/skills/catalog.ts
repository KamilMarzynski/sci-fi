import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SkillBundle, SkillManifest } from "./types.js";

export interface LoadCatalogOptions {
  readonly bodiesRoot: string;
  readonly manifestsRoot: string;
}

export async function loadCatalog(
  options: LoadCatalogOptions,
): Promise<SkillBundle[]> {
  const entries = await readdir(options.bodiesRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const seenIds = new Set<string>();
  const bundles: SkillBundle[] = [];

  for (const folder of directories) {
    const manifest = await loadManifest(
      join(options.manifestsRoot, folder, "manifest.js"),
    );

    if (manifest.id !== folder) {
      throw new Error(
        `manifest.id "${manifest.id}" does not match folder "${folder}"`,
      );
    }

    if (seenIds.has(manifest.id)) {
      throw new Error(`Duplicate skill id "${manifest.id}"`);
    }

    seenIds.add(manifest.id);

    const bodyPath = join(options.bodiesRoot, folder, "body.md");
    await assertFileExists(bodyPath);
    const body = await readFile(bodyPath, { encoding: "utf8" });

    bundles.push({ manifest, body });
  }

  return bundles;
}

async function loadManifest(modulePath: string): Promise<SkillManifest> {
  await assertFileExists(modulePath);
  const moduleUrl = pathToFileURL(modulePath).href;
  const imported = (await import(moduleUrl)) as { manifest?: unknown };

  if (
    imported.manifest === undefined ||
    typeof imported.manifest !== "object" ||
    imported.manifest === null
  ) {
    throw new Error(`manifest export missing from ${modulePath}`);
  }

  return imported.manifest as SkillManifest;
}

async function assertFileExists(path: string): Promise<void> {
  await stat(path).catch((error: unknown) => {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error(`Missing file: ${path}`);
    }

    throw error;
  });
}
