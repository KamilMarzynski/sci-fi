import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldInit } from "../../../src/core/init/scaffold.js";

describe("scaffoldInit", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map(async (directory) => {
        const { rm } = await import("node:fs/promises");
        await rm(directory, { force: true, recursive: true });
      }),
    );
    temporaryDirectories.length = 0;
  });

  it("creates the base specflow directories and bootstrap docs", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await scaffoldInit({ projectRoot });

    await expectDirectory(join(projectRoot, "docs", "specflow", ".specflow"));
    await expectDirectory(join(projectRoot, "docs", "specflow", "specs"));
    await expectDirectory(join(projectRoot, "docs", "specflow", "bugs"));

    expect(readFileSync(join(projectRoot, "docs", "specflow", "TESTING.md"), "utf8")).toBe(
      expectedTestingDocument,
    );
    expect(readFileSync(join(projectRoot, "docs", "specflow", "ROADMAP.md"), "utf8")).toBe(
      expectedRoadmapDocument,
    );
  });

  it("preserves existing docs when rerun", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow"), { recursive: true });
    writeFileSync(
      join(projectRoot, "docs", "specflow", "TESTING.md"),
      "# Existing testing\nDo not replace.\n",
      "utf8",
    );
    writeFileSync(
      join(projectRoot, "docs", "specflow", "ROADMAP.md"),
      "# Existing roadmap\nKeep this plan.\n",
      "utf8",
    );

    await scaffoldInit({ projectRoot });

    expect(readFileSync(join(projectRoot, "docs", "specflow", "TESTING.md"), "utf8")).toBe(
      "# Existing testing\nDo not replace.\n",
    );
    expect(readFileSync(join(projectRoot, "docs", "specflow", "ROADMAP.md"), "utf8")).toBe(
      "# Existing roadmap\nKeep this plan.\n",
    );
  });

  it("fails when a doc path already exists as a directory", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow", "TESTING.md"), { recursive: true });

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, "docs", "specflow", "TESTING.md")}: path exists and is not a regular file.`,
    });
  });

  it("does not create bootstrap directories when a doc path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow", "ROADMAP.md"), { recursive: true });

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, "docs", "specflow", "ROADMAP.md")}: path exists and is not a regular file.`,
    });

    await expect(access(join(projectRoot, "docs", "specflow", ".specflow"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "docs", "specflow", "specs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "docs", "specflow", "bugs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails without partial writes when a scaffold directory path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow"), { recursive: true });
    writeFileSync(join(projectRoot, "docs", "specflow", "specs"), "conflict", "utf8");

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold directory at ${join(projectRoot, "docs", "specflow", "specs")}: path exists and is not a directory.`,
    });

    await expect(access(join(projectRoot, "docs", "specflow", ".specflow"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const conflictingEntry = await stat(join(projectRoot, "docs", "specflow", "specs"));
    expect(conflictingEntry.isFile()).toBe(true);
    expect(readFileSync(join(projectRoot, "docs", "specflow", "specs"), "utf8")).toBe("conflict");
    await expect(access(join(projectRoot, "docs", "specflow", "bugs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "docs", "specflow", "TESTING.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "docs", "specflow", "ROADMAP.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

const expectedTestingDocument = `# TESTING.md

Testing is a release gate for this repository.

## Required Checks

- Run targeted tests for the module you changed.
- Add filesystem-level coverage for scaffolding and generated output.
- Verify command behavior end to end once CLI wiring exists.

## Verification Notes

- Prefer deterministic tests over mocks for file generation.
- Inspect generated files for meaningful content, not only existence.
- Record any skipped verification so the gap is explicit.
`;

const expectedRoadmapDocument = `# ROADMAP.md

## Milestones

1. Define the workflows and templates this repository needs.
2. Implement core logic with reusable modules and test coverage.
3. Add CLI commands that exercise the core behavior safely.

## Near-Term Focus

- Keep generated project conventions clear and easy to maintain.
- Expand verification as more commands become user-facing.
- Use this roadmap to track the next approved increments.
`;

async function expectDirectory(directoryPath: string): Promise<void> {
  await access(directoryPath);
  const directoryEntry = await stat(directoryPath);

  expect(directoryEntry.isDirectory()).toBe(true);
}
