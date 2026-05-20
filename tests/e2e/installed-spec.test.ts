import {
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledCommand,
} from "./installed-test-helpers.js";

describe("installed build spec verification", () => {
  it("creates a feature container from an installed package", () => {
    const installation = createInstalledPackageTestEnvironment("installed-spec-");

    try {
      const result = runInstalledCommand(installation.installDirectory, [
        "spec",
        "user-auth",
        "--title",
        "User Auth",
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const metadataPath = join(
        installation.installDirectory,
        "docs",
        "specflow",
        "specs",
        "user-auth",
        ".specflow.json",
      );
      expect(existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      expect(metadata.slug).toBe("user-auth");
      expect(metadata.title).toBe("User Auth");
      expect(metadata.status).toBe("created");
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
});
