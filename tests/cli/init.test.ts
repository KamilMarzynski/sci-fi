import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { access, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";

describe("specflow init", () => {
  const temporaryDirectories: string[] = [];
  const originalWorkingDirectory = process.cwd();

  afterEach(async () => {
    process.chdir(originalWorkingDirectory);

    await Promise.all(
      temporaryDirectories.map(async (directory) => {
        await rm(directory, { force: true, recursive: true });
      }),
    );
    temporaryDirectories.length = 0;
  });

  it("creates the baseline project structure in the current working directory", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-cli-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await buildProgram().parseAsync(["node", "specflow", "init"]);

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

  it("fails without partial writes when a bootstrap doc path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-cli-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, "TESTING.md"));

    await expect(
      buildProgram().parseAsync(["node", "specflow", "init"]),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        `${join("TESTING.md")}: path exists and is not a regular file.`,
      ),
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
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-cli-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    writeFileSync(join(projectRoot, ".specflow"), "conflict", "utf8");

    await expect(
      buildProgram().parseAsync(["node", "specflow", "init"]),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        `${join(".specflow")}: path exists and is not a directory.`,
      ),
    });

    expect(readFileSync(join(projectRoot, ".specflow"), "utf8")).toBe("conflict");
    await expect(access(join(projectRoot, "specs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
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

- Capture new feature work in \`specs/\` before implementing.
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
