import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledInit,
} from "./installed-test-helpers.js";

describe("installed build init verification", () => {
  it("initializes the project structure from an installed package in the dedicated workspace", () => {
    const installation = createInstalledPackageTestEnvironment("installed-init-");

    try {
      const result = runInstalledInit(installation.installDirectory);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", ".specflow"))).toBe(true);
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", "specs"))).toBe(true);
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", "bugs"))).toBe(true);
      expect(readFileSync(join(installation.installDirectory, "docs", "specflow", "TESTING.md"), "utf8")).toBe(
        expectedTestingDocument,
      );
      expect(readFileSync(join(installation.installDirectory, "docs", "specflow", "ROADMAP.md"), "utf8")).toBe(
        expectedRoadmapDocument,
      );
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it("allows a safe installed-build rerun without overwriting existing bootstrap docs or generated files", () => {
    const installation = createInstalledPackageTestEnvironment("installed-init-");

    try {
      const initialRun = runInstalledInit(installation.installDirectory);

      expect(initialRun.status).toBe(0);
      expect(initialRun.stderr).toBe("");

      const specflowRoot = join(installation.installDirectory, "docs", "specflow");
      const testingPath = join(specflowRoot, "TESTING.md");
      const roadmapPath = join(specflowRoot, "ROADMAP.md");
      const specPath = join(specflowRoot, "specs", "existing-spec.md");
      const bugPath = join(specflowRoot, "bugs", "existing-bug.md");
      const statePath = join(specflowRoot, ".specflow", "state.json");

      writeFileSync(testingPath, preservedTestingDocument, "utf8");
      writeFileSync(roadmapPath, preservedRoadmapDocument, "utf8");
      writeFileSync(specPath, preservedSpecDocument, "utf8");
      writeFileSync(bugPath, preservedBugDocument, "utf8");
      writeFileSync(statePath, preservedStateDocument, "utf8");

      const rerun = runInstalledInit(installation.installDirectory);

      expect(rerun.status).toBe(0);
      expect(rerun.stderr).toBe("");
      expect(readFileSync(testingPath, "utf8")).toBe(preservedTestingDocument);
      expect(readFileSync(roadmapPath, "utf8")).toBe(preservedRoadmapDocument);
      expect(readFileSync(specPath, "utf8")).toBe(preservedSpecDocument);
      expect(readFileSync(bugPath, "utf8")).toBe(preservedBugDocument);
      expect(readFileSync(statePath, "utf8")).toBe(preservedStateDocument);
      expect(existsSync(join(specflowRoot, ".specflow"))).toBe(true);
      expect(existsSync(join(specflowRoot, "specs"))).toBe(true);
      expect(existsSync(join(specflowRoot, "bugs"))).toBe(true);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it("returns a stable non-zero exit and concise stderr on an init conflict", () => {
    const installation = createInstalledPackageTestEnvironment("installed-init-");

    try {
      mkdirSync(join(installation.installDirectory, "docs", "specflow"), { recursive: true });
      writeFileSync(join(installation.installDirectory, "docs", "specflow", "bugs"), "conflict", "utf8");

      const result = runInstalledInit(installation.installDirectory);
      const expectedErrorMessage = `Cannot scaffold directory at ${join(installation.installDirectory, "docs", "specflow", "bugs")}: path exists and is not a directory.`;

      expect(result.status).not.toBe(0);
      expect(result.stderr).toBe(`${expectedErrorMessage}\n`);
      expect(result.stderr).not.toContain("Error:");
      expect(result.stderr).not.toContain("node:internal");
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", ".specflow"))).toBe(false);
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", "specs"))).toBe(false);
      expect(readFileSync(join(installation.installDirectory, "docs", "specflow", "bugs"), "utf8")).toBe(
        "conflict",
      );
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", "TESTING.md"))).toBe(false);
      expect(existsSync(join(installation.installDirectory, "docs", "specflow", "ROADMAP.md"))).toBe(false);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
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

const preservedTestingDocument = `# TESTING.md

Preserve this custom testing note on rerun.
`;

const preservedRoadmapDocument = `# ROADMAP.md

Preserve this custom roadmap note on rerun.
`;

const preservedSpecDocument = `# Existing Spec

This generated spec file must survive init reruns.
`;

const preservedBugDocument = `# Existing Bug

This generated bug file must survive init reruns.
`;

const preservedStateDocument = `{"initialized":true,"preserve":"yes"}\n`;
