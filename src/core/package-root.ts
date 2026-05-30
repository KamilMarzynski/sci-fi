import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function findPackageRoot(startUrl: string | URL): string {
  const startPath = fileURLToPath(startUrl);
  let dir = dirname(startPath);

  while (true) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`No package.json found above ${startPath}`);
    }

    dir = parent;
  }
}
