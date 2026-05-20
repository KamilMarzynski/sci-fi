import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const verificationRoot = join(repositoryRoot, ".testing");
const sandboxesRoot = join(verificationRoot, "sandboxes");
const artifactsRoot = join(verificationRoot, "artifacts");

type InstalledDependencyNode = {
  path?: string;
  dependencies?: Record<string, InstalledDependencyNode>;
};

type InstalledDependencyTree = InstalledDependencyNode & {
  _dependencies?: Record<string, string>;
};

function isInstalledDependencyNode(value: unknown): value is InstalledDependencyNode {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const dependencies = Reflect.get(value, "dependencies");
  const path = Reflect.get(value, "path");

  return (
    (path === undefined || typeof path === "string") &&
    (
      dependencies === undefined ||
      (typeof dependencies === "object" &&
        dependencies !== null &&
        !Array.isArray(dependencies))
    )
  );
}

function isInstalledDependencyTree(value: unknown): value is InstalledDependencyTree {
  if (!isInstalledDependencyNode(value)) {
    return false;
  }

  const declaredDependencies = Reflect.get(value, "_dependencies");

  return (
    declaredDependencies === undefined ||
    (typeof declaredDependencies === "object" &&
      declaredDependencies !== null &&
      !Array.isArray(declaredDependencies))
  );
}

function readInstalledProductionDependencyTree(): InstalledDependencyTree {
  const dependencyTreeContents = execFileSync(
    "npm",
    ["ls", "--omit=dev", "--all", "--json", "--long"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  const dependencyTree = JSON.parse(dependencyTreeContents);

  if (!isInstalledDependencyTree(dependencyTree)) {
    throw new Error("Expected npm ls to return an installed dependency tree");
  }

  return dependencyTree;
}

function collectInstalledDependencyPaths(
  dependencyTree: InstalledDependencyTree,
): string[] {
  const stagedPaths = new Set<string>();
  const pendingNodes = Object.keys(dependencyTree._dependencies ?? {}).map(
    (dependencyName) => dependencyTree.dependencies?.[dependencyName],
  );

  while (pendingNodes.length > 0) {
    const dependencyNode = pendingNodes.pop();

    if (dependencyNode === undefined) {
      continue;
    }

    if (dependencyNode.path === undefined) {
      throw new Error("Expected installed dependency node to include a package path");
    }

    if (stagedPaths.has(dependencyNode.path)) {
      continue;
    }

    stagedPaths.add(dependencyNode.path);
    pendingNodes.push(...Object.values(dependencyNode.dependencies ?? {}));
  }

  return [...stagedPaths];
}

function packPackage(
  packageSpecifier: string,
  packDirectory: string,
  npmEnvironment: NodeJS.ProcessEnv,
): string {
  const existingArtifacts = new Set(readdirSync(packDirectory));

  execFileSync("npm", ["pack", packageSpecifier, "--pack-destination", packDirectory], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: npmEnvironment,
  });

  const newArtifacts = readdirSync(packDirectory).filter(
    (entry) => entry.endsWith(".tgz") && !existingArtifacts.has(entry),
  );

  expect(newArtifacts).toHaveLength(1);

  const [artifactName] = newArtifacts;

  if (artifactName === undefined) {
    throw new Error(`Expected npm pack to produce one tarball for ${packageSpecifier}`);
  }

  return join(packDirectory, artifactName);
}

describe("installed build init verification", () => {
  it("initializes the project structure from an installed package in the dedicated workspace", () => {
    const installation = createInstalledPackageTestEnvironment();

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
    const installation = createInstalledPackageTestEnvironment();

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
    const installation = createInstalledPackageTestEnvironment();

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

type InstalledPackageTestEnvironment = {
  artifactRoot: string;
  installDirectory: string;
  sandboxRoot: string;
};

function createInstalledPackageTestEnvironment(): InstalledPackageTestEnvironment {
  const sandboxRoot = mkdtempSync(join(sandboxesRoot, "installed-init-"));
  const artifactRoot = mkdtempSync(join(artifactsRoot, "installed-init-"));
  const packDirectory = join(artifactRoot, "pack");
  const installDirectory = join(sandboxRoot, "workspace");
  const cacheDirectory = join(sandboxRoot, ".npm-cache");
  const npmEnvironment = {
    ...process.env,
    npm_config_cache: cacheDirectory,
  };

  mkdirSync(packDirectory, { recursive: true });
  mkdirSync(installDirectory, { recursive: true });
  mkdirSync(cacheDirectory, { recursive: true });

  const installedDependencyTree = readInstalledProductionDependencyTree();
  const packageArtifactPath = packPackage(".", packDirectory, npmEnvironment);
  const runtimeDependencyArtifactPaths = collectInstalledDependencyPaths(
    installedDependencyTree,
  ).map((dependencyPath) => packPackage(dependencyPath, packDirectory, npmEnvironment));

  writeFileSync(
    join(installDirectory, "package.json"),
    JSON.stringify({ name: "specflow-installed-init-test", private: true }),
  );

  execFileSync(
    "npm",
    [
      "install",
      "--offline",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      ...runtimeDependencyArtifactPaths,
      packageArtifactPath,
    ],
    {
      cwd: installDirectory,
      encoding: "utf8",
      env: npmEnvironment,
    },
  );

  return {
    artifactRoot,
    installDirectory,
    sandboxRoot,
  };
}

function cleanupInstalledPackageTestEnvironment(
  environment: InstalledPackageTestEnvironment,
): void {
  rmSync(environment.sandboxRoot, { force: true, recursive: true });
  rmSync(environment.artifactRoot, { force: true, recursive: true });
}

function runInstalledInit(installDirectory: string) {
  const installedBinPath = join(installDirectory, "node_modules/.bin/specflow");

  return spawnSync(installedBinPath, ["init"], {
    cwd: installDirectory,
    encoding: "utf8",
  });
}

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
