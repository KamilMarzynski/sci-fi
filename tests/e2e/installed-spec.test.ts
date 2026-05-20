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

describe("installed build spec verification", () => {
  it("creates a feature container from an installed package", () => {
    const installation = createInstalledPackageTestEnvironment();

    try {
      const result = runInstalledSpec(installation.installDirectory, [
        "user-auth",
        "--title",
        "User Auth",
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const metadataPath = join(
        installation.installDirectory,
        "docs",
        "specflow",
        "specs",
        "user-auth",
        ".specflow.json",
      );
      expect(existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      expect(metadata.slug).toBe("user-auth");
      expect(metadata.title).toBe("User Auth");
      expect(metadata.status).toBe("created");
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
  const sandboxRoot = mkdtempSync(join(sandboxesRoot, "installed-spec-"));
  const artifactRoot = mkdtempSync(join(artifactsRoot, "installed-spec-"));
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
    JSON.stringify({ name: "specflow-installed-spec-test", private: true }),
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

function runInstalledSpec(installDirectory: string, args: string[]) {
  const installedBinPath = join(installDirectory, "node_modules/.bin/specflow");

  return spawnSync(installedBinPath, ["spec", ...args], {
    cwd: installDirectory,
    encoding: "utf8",
  });
}
