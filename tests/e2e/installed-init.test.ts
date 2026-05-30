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
  it(
    "initializes the project structure from an installed package in the dedicated workspace",
    () => {
      const installation = createInstalledPackageTestEnvironment("installed-init-");

      try {
        const result = runInstalledInit(installation.installDirectory, [
          "--harness",
          "claude-code",
        ]);

        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        expect(existsSync(join(installation.installDirectory, "docs", "specflow", ".specflow"))).toBe(true);
        expect(existsSync(join(installation.installDirectory, "docs", "specflow", "specs"))).toBe(true);
        expect(existsSync(join(installation.installDirectory, "docs", "specflow", "bugs"))).toBe(true);
        expect(
          readFileSync(
            join(installation.installDirectory, "docs", "specflow", "EVALUATION.md"),
            "utf8",
          ),
        ).toBe(expectedEvaluationDocument);
        expect(
          readFileSync(
            join(installation.installDirectory, "docs", "specflow", "ROADMAP.md"),
            "utf8",
          ),
        ).toBe(expectedRoadmapDocument);

        expect(
          existsSync(
            join(
              installation.installDirectory,
              ".claude",
              "skills",
              "sf-feature",
              "SKILL.md",
            ),
          ),
        ).toBe(true);
        expect(
          existsSync(
            join(installation.installDirectory, ".claude", "agents", "sf-code-review.md"),
          ),
        ).toBe(true);

        const config = JSON.parse(
          readFileSync(
            join(
              installation.installDirectory,
              "docs",
              "specflow",
              ".specflow",
              "config.json",
            ),
            "utf8",
          ),
        );
        expect(config).toEqual({ version: 1, harness: "claude-code" });
      } finally {
        cleanupInstalledPackageTestEnvironment(installation);
      }
    },
  );

  it(
    "allows a safe installed-build rerun without overwriting existing bootstrap docs or generated files",
    () => {
      const installation = createInstalledPackageTestEnvironment("installed-init-");

      try {
        const initialRun = runInstalledInit(installation.installDirectory, [
          "--harness",
          "claude-code",
          "--yes",
        ]);

        expect(initialRun.status).toBe(0);
        expect(initialRun.stderr).toBe("");

        const specflowRoot = join(installation.installDirectory, "docs", "specflow");
        const evaluationPath = join(specflowRoot, "EVALUATION.md");
        const roadmapPath = join(specflowRoot, "ROADMAP.md");
        const specPath = join(specflowRoot, "specs", "existing-spec.md");
        const bugPath = join(specflowRoot, "bugs", "existing-bug.md");
        const statePath = join(specflowRoot, ".specflow", "state.json");
        const skillPath = join(
          installation.installDirectory,
          ".claude",
          "skills",
          "sf-feature",
          "SKILL.md",
        );
        const agentPath = join(
          installation.installDirectory,
          ".claude",
          "agents",
          "sf-code-review.md",
        );

        writeFileSync(evaluationPath, preservedEvaluationDocument, "utf8");
        writeFileSync(roadmapPath, preservedRoadmapDocument, "utf8");
        writeFileSync(specPath, preservedSpecDocument, "utf8");
        writeFileSync(bugPath, preservedBugDocument, "utf8");
        writeFileSync(statePath, preservedStateDocument, "utf8");

        const skillBeforeRerun = readFileSync(skillPath, "utf8");
        const agentBeforeRerun = readFileSync(agentPath, "utf8");
        writeFileSync(skillPath, "user override\n", "utf8");
        writeFileSync(agentPath, "user override\n", "utf8");

        const rerun = runInstalledInit(installation.installDirectory, [
          "--harness",
          "claude-code",
          "--yes",
        ]);

        expect(rerun.status).toBe(0);
        expect(rerun.stderr).toBe("");
        expect(readFileSync(evaluationPath, "utf8")).toBe(preservedEvaluationDocument);
        expect(readFileSync(roadmapPath, "utf8")).toBe(preservedRoadmapDocument);
        expect(readFileSync(specPath, "utf8")).toBe(preservedSpecDocument);
        expect(readFileSync(bugPath, "utf8")).toBe(preservedBugDocument);
        expect(readFileSync(statePath, "utf8")).toBe(preservedStateDocument);
        expect(existsSync(join(specflowRoot, ".specflow"))).toBe(true);
        expect(existsSync(join(specflowRoot, "specs"))).toBe(true);
        expect(existsSync(join(specflowRoot, "bugs"))).toBe(true);

        // Bundled sf-* skills and agents are spec-flow-owned: rerun must
        // overwrite local edits back to the bundled content (documented in
        // README).
        expect(readFileSync(skillPath, "utf8")).toBe(skillBeforeRerun);
        expect(readFileSync(agentPath, "utf8")).toBe(agentBeforeRerun);
      } finally {
        cleanupInstalledPackageTestEnvironment(installation);
      }
    },
  );

  it(
    "returns a stable non-zero exit and concise stderr on an init conflict",
    () => {
      const installation = createInstalledPackageTestEnvironment("installed-init-");

      try {
        mkdirSync(join(installation.installDirectory, "docs", "specflow"), { recursive: true });
        writeFileSync(
          join(installation.installDirectory, "docs", "specflow", "bugs"),
          "conflict",
          "utf8",
        );

        const result = runInstalledInit(installation.installDirectory, [
          "--harness",
          "claude-code",
          "--yes",
        ]);
        const expectedErrorMessage = `Cannot scaffold directory at ${join(installation.installDirectory, "docs", "specflow", "bugs")}: path exists and is not a directory.`;

        expect(result.status).not.toBe(0);
        expect(result.stderr).toBe(`${expectedErrorMessage}\n`);
        expect(result.stderr).not.toContain("Error:");
        expect(result.stderr).not.toContain("node:internal");
        expect(
          existsSync(join(installation.installDirectory, "docs", "specflow", ".specflow")),
        ).toBe(false);
        expect(
          existsSync(join(installation.installDirectory, "docs", "specflow", "specs")),
        ).toBe(false);
        expect(
          readFileSync(
            join(installation.installDirectory, "docs", "specflow", "bugs"),
            "utf8",
          ),
        ).toBe("conflict");
        expect(
          existsSync(join(installation.installDirectory, "docs", "specflow", "EVALUATION.md")),
        ).toBe(false);
        expect(
          existsSync(join(installation.installDirectory, "docs", "specflow", "ROADMAP.md")),
        ).toBe(false);
        expect(existsSync(join(installation.installDirectory, ".claude"))).toBe(false);
      } finally {
        cleanupInstalledPackageTestEnvironment(installation);
      }
    },
  );

  it(
    "returns a stable non-zero exit when the chosen harness is not implemented",
    () => {
      const installation = createInstalledPackageTestEnvironment("installed-init-");

      try {
        const result = runInstalledInit(installation.installDirectory, [
          "--harness",
          "opencode",
        ]);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("opencode");
        expect(result.stderr).toContain("not implemented");
        expect(existsSync(join(installation.installDirectory, ".claude"))).toBe(false);
        expect(
          existsSync(
            join(installation.installDirectory, "docs", "specflow", "EVALUATION.md"),
          ),
        ).toBe(false);
      } finally {
        cleanupInstalledPackageTestEnvironment(installation);
      }
    },
  );
});

const expectedEvaluationDocument = `# EVALUATION.md

Evaluation is a release gate for this repository.

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

const preservedEvaluationDocument = `# EVALUATION.md

Preserve this custom evaluation note on rerun.
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
