import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";
import { readBugFile } from "../../src/core/bugs/frontmatter.js";
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

describe("bug command", () => {
  it("creates a standalone bug file and prints id and path", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

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
        "bug",
        "login crash on mobile",
      ]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("BUG-0001");
    expect(combined).toContain("login-crash-on-mobile");

    const bugPath = join(projectRoot, "bugs", "BUG-0001-login-crash-on-mobile.md");
    const file = await readBugFile(bugPath);
    expect(file.frontmatter.status).toBe("open");
  });

  it("creates a bug with severity and related-feature flags", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await buildProgram().parseAsync([
      "node",
      "specflow",
      "bug",
      "null ref in checkout",
      "--severity",
      "high",
      "--related-feature",
      "payments",
    ]);

    const bugPath = join(projectRoot, "bugs", "BUG-0001-null-ref-in-checkout.md");
    const file = await readBugFile(bugPath);
    expect(file.frontmatter.severity).toBe("high");
    expect(file.frontmatter["related-feature"]).toBe("payments");
  });

  it("rejects invalid severity values", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli(["bug", "something", "--severity", "invalid"]);
    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain("Invalid severity");
    expect(run.stderr).toContain("INVALID_ARGUMENT");
  });
});
