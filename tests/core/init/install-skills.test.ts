import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { installSkills } from "../../../src/core/init/install-skills.js";
import { HarnessNotImplementedError } from "../../../src/core/skills/harness/adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..", "..", "..");

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

describe("installSkills", () => {
  it("installs all 10 bundled skills to the claude-code targets", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-install-"));
    temporaryDirectories.push(projectRoot);

    await installSkills({
      projectRoot,
      harness: "claude-code",
      packageRoot,
    });

    for (const id of [
      "sf-feature",
      "sf-plan",
      "sf-fix",
      "sf-bug",
      "sf-implement",
    ]) {
      expect(
        existsSync(join(projectRoot, ".claude", "skills", id, "SKILL.md")),
      ).toBe(true);
    }

    for (const id of [
      "spec-review",
      "plan-review",
      "code-review",
      "verification",
      "tdd",
    ]) {
      expect(
        existsSync(join(projectRoot, ".claude", "agents", `${id}.md`)),
      ).toBe(true);
    }
  });

  it("throws HarnessNotImplementedError for opencode without writing anything", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-install-"));
    temporaryDirectories.push(projectRoot);

    await expect(
      installSkills({ projectRoot, harness: "opencode", packageRoot }),
    ).rejects.toThrowError(HarnessNotImplementedError);

    expect(existsSync(join(projectRoot, ".claude"))).toBe(false);
  });
});
