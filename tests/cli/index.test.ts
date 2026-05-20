import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProgram, isDirectExecution } from "../../src/cli/index.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("buildProgram", () => {
  it("registers the init command", () => {
    const program = buildProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain("init");
    expect(commandNames).toContain("spec");
  });

  it("runs init against the current working directory", async () => {
    const program = buildProgram();
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-build-program-"));
    const originalWorkingDirectory = process.cwd();

    process.chdir(projectRoot);

    try {
      const parsedProgram = await program.parseAsync(["node", "specflow", "init"]);

      expect(parsedProgram).toBe(program);

      expect(existsSync(join(projectRoot, ".specflow"))).toBe(true);
      expect(existsSync(join(projectRoot, "specs"))).toBe(true);
      expect(existsSync(join(projectRoot, "bugs"))).toBe(true);
    } finally {
      process.chdir(originalWorkingDirectory);
      rmSync(projectRoot, { force: true, recursive: true });
    }
  });
});

describe("isDirectExecution", () => {
  it("matches normalized filesystem paths", () => {
    expect(
      isDirectExecution(
        "file:///Users/mayk/Projects/private/spec-flow/dist/cli/index.js",
        [
          "node",
          "/Users/mayk/Projects/private/spec-flow/dist/cli/../cli/index.js",
        ],
      ),
    ).toBe(true);
  });

  it("returns false when no script path is provided", () => {
    expect(
      isDirectExecution(
        "file:///Users/mayk/Projects/private/spec-flow/dist/cli/index.js",
        ["node"],
      ),
    ).toBe(false);
  });
});

describe("installed artifact cli", () => {
  it("initializes the project structure from the installed bin", () => {
    const sandboxRoot = mkdtempSync(join(tmpdir(), "specflow-installed-cli-"));
    const packDirectory = join(sandboxRoot, "pack");
    const installDirectory = join(sandboxRoot, "install");
    const cacheDirectory = join(sandboxRoot, ".npm-cache");
    const npmEnvironment = {
      ...process.env,
      npm_config_cache: cacheDirectory,
    };

    try {
      mkdirSync(packDirectory, { recursive: true });
      mkdirSync(installDirectory, { recursive: true });
      mkdirSync(cacheDirectory, { recursive: true });

      execFileSync(
        "npm",
        ["pack", "--pack-destination", packDirectory],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: npmEnvironment,
        },
      );

      const [artifactName] = readdirSync(packDirectory).filter((entry) =>
        entry.endsWith(".tgz"),
      );
      expect(artifactName).toBeDefined();

      if (artifactName === undefined) {
        throw new Error("Expected npm pack to produce a .tgz artifact");
      }

      execFileSync(
        "npm",
        [
          "pack",
          "./node_modules/commander",
          "--pack-destination",
          packDirectory,
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: npmEnvironment,
        },
      );

      const [commanderArtifactName] = readdirSync(packDirectory).filter((entry) =>
        entry.startsWith("commander-") && entry.endsWith(".tgz"),
      );
      expect(commanderArtifactName).toBeDefined();

      if (commanderArtifactName === undefined) {
        throw new Error("Expected commander tarball for offline install");
      }

      writeFileSync(
        join(installDirectory, "package.json"),
        JSON.stringify({ name: "specflow-cli-test", private: true }),
      );

      execFileSync(
        "npm",
        [
          "install",
          "--offline",
          "--no-audit",
          "--no-fund",
          "--no-package-lock",
          join(packDirectory, commanderArtifactName),
          join(packDirectory, artifactName),
        ],
        {
          cwd: installDirectory,
          encoding: "utf8",
          env: npmEnvironment,
        },
      );

      const installedBinPath = join(
        installDirectory,
        "node_modules/.bin/specflow",
      );

      const result = spawnSync(installedBinPath, ["init"], {
        cwd: installDirectory,
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(existsSync(join(installDirectory, ".specflow"))).toBe(true);
      expect(existsSync(join(installDirectory, "specs"))).toBe(true);
      expect(existsSync(join(installDirectory, "bugs"))).toBe(true);
    } finally {
      rmSync(sandboxRoot, { force: true, recursive: true });
    }
  });
});
