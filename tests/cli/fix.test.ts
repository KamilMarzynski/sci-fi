import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";
import { readFixFile } from "../../src/core/fixes/frontmatter.js";
import { runCli } from "./helpers.js";

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

async function scaffoldFeature(projectRoot: string, slug: string): Promise<void> {
  const featureDir = join(projectRoot, "docs", "specflow", "specs", slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, ".specflow.json"),
    JSON.stringify({
      version: 1,
      id: "FEAT-0001",
      slug,
      status: "in-progress",
      createdAt: "2026-05-21T00:00:00Z",
      updatedAt: "2026-05-21T00:00:00Z",
    }),
    "utf8",
  );
}

describe("fix command", () => {
  it("creates a fix file inside the feature's fixes/ dir and prints id and path", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);
    await scaffoldFeature(projectRoot, "auth-flow");

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync([
        "node",
        "specflow",
        "fix",
        "token expiry off by one",
        "--feature",
        "auth-flow",
      ]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("FIX-0001");
    expect(combined).toContain("token-expiry-off-by-one");

    const fixPath = join(
      projectRoot,
      "docs",
      "specflow",
      "specs",
      "auth-flow",
      "fixes",
      "FIX-0001-token-expiry-off-by-one.md",
    );
    const file = await readFixFile(fixPath);
    expect(file.frontmatter.feature).toBe("auth-flow");
    expect(file.frontmatter.status).toBe("open");
  });

  it("fails when --feature flag is omitted", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await expect(
      buildProgram().parseAsync([
        "node",
        "specflow",
        "fix",
        "some description",
      ]),
    ).rejects.toThrow();
  });

  it("fails when the feature slug does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(["fix", "some description", "--feature", "nonexistent"]);
    expect(run.exitCode).toBe(3);
    expect(run.stderr).toContain('Feature "nonexistent" does not exist.');
    expect(run.stderr).toContain("NOT_FOUND");
  });
});
