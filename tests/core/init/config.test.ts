import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeConfig } from "../../../src/core/init/config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

describe("writeConfig", () => {
  it("writes config.json with the chosen harness", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-config-"));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, "docs", "specflow", ".specflow"), {
      recursive: true,
    });

    await writeConfig({ projectRoot, harness: "claude-code" });

    const written = JSON.parse(
      readFileSync(
        join(projectRoot, "docs", "specflow", ".specflow", "config.json"),
        "utf8",
      ),
    );

    expect(written).toEqual({ version: 1, harness: "claude-code" });
  });

  it("preserves existing config.json on rerun", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-config-"));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, "docs", "specflow", ".specflow"), {
      recursive: true,
    });
    const { writeFile } = await import("node:fs/promises");
    const configPath = join(
      projectRoot,
      "docs",
      "specflow",
      ".specflow",
      "config.json",
    );
    await writeFile(configPath, '{"version":1,"harness":"opencode"}', "utf8");

    await writeConfig({ projectRoot, harness: "claude-code" });

    expect(readFileSync(configPath, "utf8")).toBe(
      '{"version":1,"harness":"opencode"}',
    );
  });
});
