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

    await buildProgram().parseAsync(["node", "specflow", "init", "--yes"]);

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

  it("fails without partial writes when a bootstrap doc path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-cli-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow", "TESTING.md"), { recursive: true });

    await expect(
      buildProgram().parseAsync(["node", "specflow", "init", "--yes"]),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        `${join("docs", "specflow", "TESTING.md")}: path exists and is not a regular file.`,
      ),
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
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-cli-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow"), { recursive: true });
    writeFileSync(join(projectRoot, "docs", "specflow", ".specflow"), "conflict", "utf8");

    await expect(
      buildProgram().parseAsync(["node", "specflow", "init", "--yes"]),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        `${join("docs", "specflow", ".specflow")}: path exists and is not a directory.`,
      ),
    });

    expect(readFileSync(join(projectRoot, "docs", "specflow", ".specflow"), "utf8")).toBe("conflict");
    await expect(access(join(projectRoot, "docs", "specflow", "specs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
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
