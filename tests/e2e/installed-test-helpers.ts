import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const verificationRoot = join(repositoryRoot, '.testing');
export const sandboxesRoot = join(verificationRoot, 'sandboxes');
export const artifactsRoot = join(verificationRoot, 'artifacts');

export type InstalledDependencyNode = {
  path?: string;
  dependencies?: Record<string, InstalledDependencyNode>;
};

export type InstalledDependencyTree = InstalledDependencyNode & {
  _dependencies?: Record<string, string>;
};

export function isInstalledDependencyNode(value: unknown): value is InstalledDependencyNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const dependencies = Reflect.get(value, 'dependencies');
  const path = Reflect.get(value, 'path');

  return (
    (path === undefined || typeof path === 'string') &&
    (dependencies === undefined ||
      (typeof dependencies === 'object' && dependencies !== null && !Array.isArray(dependencies)))
  );
}

export function isInstalledDependencyTree(value: unknown): value is InstalledDependencyTree {
  if (!isInstalledDependencyNode(value)) {
    return false;
  }

  const declaredDependencies = Reflect.get(value, '_dependencies');

  return (
    declaredDependencies === undefined ||
    (typeof declaredDependencies === 'object' &&
      declaredDependencies !== null &&
      !Array.isArray(declaredDependencies))
  );
}

export function readInstalledProductionDependencyTree(): InstalledDependencyTree {
  const dependencyTreeContents = execFileSync(
    'npm',
    ['ls', '--omit=dev', '--all', '--json', '--long'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    },
  );
  const dependencyTree = JSON.parse(dependencyTreeContents);

  if (!isInstalledDependencyTree(dependencyTree)) {
    throw new Error('Expected npm ls to return an installed dependency tree');
  }

  return dependencyTree;
}

export function collectInstalledDependencyPaths(dependencyTree: InstalledDependencyTree): string[] {
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
      throw new Error('Expected installed dependency node to include a package path');
    }

    if (stagedPaths.has(dependencyNode.path)) {
      continue;
    }

    stagedPaths.add(dependencyNode.path);
    pendingNodes.push(...Object.values(dependencyNode.dependencies ?? {}));
  }

  return [...stagedPaths];
}

export function packPackage(
  packageSpecifier: string,
  packDirectory: string,
  npmEnvironment: NodeJS.ProcessEnv,
): string {
  const existingArtifacts = new Set(readdirSync(packDirectory));

  execFileSync('npm', ['pack', packageSpecifier, '--pack-destination', packDirectory], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: npmEnvironment,
  });

  const newArtifacts = readdirSync(packDirectory).filter(
    (entry) => entry.endsWith('.tgz') && !existingArtifacts.has(entry),
  );

  expect(newArtifacts).toHaveLength(1);

  const [artifactName] = newArtifacts;

  if (artifactName === undefined) {
    throw new Error(`Expected npm pack to produce one tarball for ${packageSpecifier}`);
  }

  return join(packDirectory, artifactName);
}

export type InstalledPackageTestEnvironment = {
  artifactRoot: string;
  installDirectory: string;
  sandboxRoot: string;
};

export function createInstalledPackageTestEnvironment(
  sandboxPrefix: string,
): InstalledPackageTestEnvironment {
  mkdirSync(sandboxesRoot, { recursive: true });
  mkdirSync(artifactsRoot, { recursive: true });
  const sandboxRoot = mkdtempSync(join(sandboxesRoot, sandboxPrefix));
  const artifactRoot = mkdtempSync(join(artifactsRoot, sandboxPrefix));
  const packDirectory = join(artifactRoot, 'pack');
  const installDirectory = join(sandboxRoot, 'workspace');
  const cacheDirectory = join(sandboxRoot, '.npm-cache');
  const npmEnvironment = {
    ...process.env,
    npm_config_cache: cacheDirectory,
  };

  mkdirSync(packDirectory, { recursive: true });
  mkdirSync(installDirectory, { recursive: true });
  mkdirSync(cacheDirectory, { recursive: true });

  const installedDependencyTree = readInstalledProductionDependencyTree();
  const packageArtifactPath = packPackage('.', packDirectory, npmEnvironment);
  const runtimeDependencyArtifactPaths = collectInstalledDependencyPaths(
    installedDependencyTree,
  ).map((dependencyPath) => packPackage(dependencyPath, packDirectory, npmEnvironment));

  writeFileSync(
    join(installDirectory, 'package.json'),
    JSON.stringify({ name: 'scifi-installed-test', private: true }),
  );

  execFileSync(
    'npm',
    [
      'install',
      '--offline',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      ...runtimeDependencyArtifactPaths,
      packageArtifactPath,
    ],
    {
      cwd: installDirectory,
      encoding: 'utf8',
      env: npmEnvironment,
    },
  );

  return {
    artifactRoot,
    installDirectory,
    sandboxRoot,
  };
}

export function cleanupInstalledPackageTestEnvironment(
  environment: InstalledPackageTestEnvironment,
): void {
  rmSync(environment.sandboxRoot, { force: true, recursive: true });
  rmSync(environment.artifactRoot, { force: true, recursive: true });
}

export interface InstalledCommandResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

export function runInstalledCommand(
  installDirectory: string,
  args: readonly string[],
): InstalledCommandResult {
  const installedBinPath = join(installDirectory, 'node_modules', '.bin', 'scifi');

  const result = spawnSync(installedBinPath, args, {
    cwd: installDirectory,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

export function runInstalledInit(
  installDirectory: string,
  args: readonly string[] = [],
): InstalledCommandResult {
  return runInstalledCommand(installDirectory, ['init', ...args]);
}
