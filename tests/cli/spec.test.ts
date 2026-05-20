import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../../src/cli/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

describe("spec command", () => {
  it("creates a feature container in the current repository", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-cli-spec-"));
    temporaryDirectories.push(projectRoot);
    const originalWorkingDirectory = process.cwd();

    process.chdir(projectRoot);

    try {
      const program = buildProgram();

      await program.parseAsync(["node", "specflow", "spec", "user-auth", "--title", "User Auth"]);

      const metadata = JSON.parse(
        await readFile(
          join(projectRoot, "docs", "specflow", "specs", "user-auth", ".specflow.json"),
          "utf8",
        ),
      );

      expect(metadata.slug).toBe("user-auth");
      expect(metadata.title).toBe("User Auth");
      expect(metadata.status).toBe("created");
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });
});
