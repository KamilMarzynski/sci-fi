import {
  existsSync,
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
      expect(existsSync(join(installation.installDirectory, ".specflow"))).toBe(true);
      expect(existsSync(join(installation.installDirectory, "specs"))).toBe(true);
      expect(existsSync(join(installation.installDirectory, "bugs"))).toBe(true);
      expect(readFileSync(join(installation.installDirectory, "AGENTS.md"), "utf8")).toBe(
        expectedAgentsDocument,
      );
      expect(readFileSync(join(installation.installDirectory, "TESTING.md"), "utf8")).toBe(
        expectedTestingDocument,
      );
      expect(readFileSync(join(installation.installDirectory, "ROADMAP.md"), "utf8")).toBe(
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

      const agentsPath = join(installation.installDirectory, "AGENTS.md");
      const testingPath = join(installation.installDirectory, "TESTING.md");
      const roadmapPath = join(installation.installDirectory, "ROADMAP.md");
      const specPath = join(installation.installDirectory, "specs", "existing-spec.md");
      const bugPath = join(installation.installDirectory, "bugs", "existing-bug.md");
      const statePath = join(installation.installDirectory, ".specflow", "state.json");

      writeFileSync(agentsPath, preservedAgentsDocument, "utf8");
      writeFileSync(testingPath, preservedTestingDocument, "utf8");
      writeFileSync(roadmapPath, preservedRoadmapDocument, "utf8");
      writeFileSync(specPath, preservedSpecDocument, "utf8");
      writeFileSync(bugPath, preservedBugDocument, "utf8");
      writeFileSync(statePath, preservedStateDocument, "utf8");

      const rerun = runInstalledInit(installation.installDirectory);

      expect(rerun.status).toBe(0);
      expect(rerun.stderr).toBe("");
      expect(readFileSync(agentsPath, "utf8")).toBe(preservedAgentsDocument);
      expect(readFileSync(testingPath, "utf8")).toBe(preservedTestingDocument);
      expect(readFileSync(roadmapPath, "utf8")).toBe(preservedRoadmapDocument);
      expect(readFileSync(specPath, "utf8")).toBe(preservedSpecDocument);
      expect(readFileSync(bugPath, "utf8")).toBe(preservedBugDocument);
      expect(readFileSync(statePath, "utf8")).toBe(preservedStateDocument);
      expect(existsSync(join(installation.installDirectory, ".specflow"))).toBe(true);
      expect(existsSync(join(installation.installDirectory, "specs"))).toBe(true);
      expect(existsSync(join(installation.installDirectory, "bugs"))).toBe(true);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it("returns a stable non-zero exit and concise stderr on an init conflict", () => {
    const installation = createInstalledPackageTestEnvironment("installed-init-");

    try {
      writeFileSync(join(installation.installDirectory, "bugs"), "conflict", "utf8");

      const result = runInstalledInit(installation.installDirectory);
      const expectedErrorMessage = `Cannot scaffold directory at ${join(installation.installDirectory, "bugs")}: path exists and is not a directory.`;

      expect(result.status).not.toBe(0);
      expect(result.stderr).toBe(`${expectedErrorMessage}\n`);
      expect(result.stderr).not.toContain("Error:");
      expect(result.stderr).not.toContain("node:internal");
      expect(existsSync(join(installation.installDirectory, ".specflow"))).toBe(false);
      expect(existsSync(join(installation.installDirectory, "specs"))).toBe(false);
      expect(readFileSync(join(installation.installDirectory, "bugs"), "utf8")).toBe(
        "conflict",
      );
      expect(existsSync(join(installation.installDirectory, "AGENTS.md"))).toBe(false);
      expect(existsSync(join(installation.installDirectory, "TESTING.md"))).toBe(false);
      expect(existsSync(join(installation.installDirectory, "ROADMAP.md"))).toBe(false);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
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

const preservedAgentsDocument = `# AGENTS.md

Preserve this custom agent guidance on rerun.
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
