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

    await expectDirectory(join(projectRoot, ".specflow"));
    await expectDirectory(join(projectRoot, "specs"));
    await expectDirectory(join(projectRoot, "bugs"));

    expect(readFileSync(join(projectRoot, "AGENTS.md"), "utf8")).toBe(
      expectedAgentsDocument,
    );
    expect(readFileSync(join(projectRoot, "TESTING.md"), "utf8")).toBe(
      expectedTestingDocument,
    );
    expect(readFileSync(join(projectRoot, "ROADMAP.md"), "utf8")).toBe(
      expectedRoadmapDocument,
    );
  });

  it("preserves existing docs when rerun", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    writeFileSync(join(projectRoot, "AGENTS.md"), "# Existing agents\n", "utf8");
    writeFileSync(
      join(projectRoot, "TESTING.md"),
      "# Existing testing\nDo not replace.\n",
      "utf8",
    );
    writeFileSync(
      join(projectRoot, "ROADMAP.md"),
      "# Existing roadmap\nKeep this plan.\n",
      "utf8",
    );

    await scaffoldInit({ projectRoot });

    expect(readFileSync(join(projectRoot, "AGENTS.md"), "utf8")).toBe(
      "# Existing agents\n",
    );
    expect(readFileSync(join(projectRoot, "TESTING.md"), "utf8")).toBe(
      "# Existing testing\nDo not replace.\n",
    );
    expect(readFileSync(join(projectRoot, "ROADMAP.md"), "utf8")).toBe(
      "# Existing roadmap\nKeep this plan.\n",
    );
  });

  it("fails when a doc path already exists as a directory", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "AGENTS.md"));

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, "AGENTS.md")}: path exists and is not a regular file.`,
    });
  });

  it("does not create bootstrap directories when a doc path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "ROADMAP.md"));

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, "ROADMAP.md")}: path exists and is not a regular file.`,
    });

    await expect(access(join(projectRoot, ".specflow"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "specs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "bugs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails without partial writes when a scaffold directory path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    writeFileSync(join(projectRoot, "specs"), "conflict", "utf8");

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold directory at ${join(projectRoot, "specs")}: path exists and is not a directory.`,
    });

    await expect(access(join(projectRoot, ".specflow"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const conflictingEntry = await stat(join(projectRoot, "specs"));
    expect(conflictingEntry.isFile()).toBe(true);
    expect(readFileSync(join(projectRoot, "specs"), "utf8")).toBe("conflict");
    await expect(access(join(projectRoot, "bugs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "AGENTS.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "TESTING.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(projectRoot, "ROADMAP.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

const expectedAgentsDocument = `# AGENTS.md

This repository uses \`specflow\` to keep implementation work aligned with written specs.

## Workflow Expectations

- Capture specflow-managed feature work in \`docs/specflow/specs/\` before implementing.
- Track production bugs in \`bugs/\` with reproduction details and fix status.
- Keep command wiring thin and move reusable logic into core modules.

## Collaboration Rules

- Treat generated docs as working agreements, not placeholders.
- Update specs and bug notes when behavior changes.
- Verify meaningful changes with automated checks before handing work off.
`;

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
