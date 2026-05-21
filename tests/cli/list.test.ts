import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe("list command", () => {
  it("prints all features when no filter applied", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, "docs", "specflow", "specs");
    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await mkdir(join(specsDir, "payment-flow"), { recursive: true });
    await writeFile(
      join(specsDir, "user-auth", ".specflow.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", title: "User Auth", status: "created", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(
      join(specsDir, "payment-flow", ".specflow.json"),
      JSON.stringify({ version: 1, id: "FEAT-0002", slug: "payment-flow", status: "spec-ready", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(["node", "specflow", "list"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("FEAT-0001");
    expect(combined).toContain("user-auth");
    expect(combined).toContain("FEAT-0002");
    expect(combined).toContain("payment-flow");
  });

  it("filters features by status", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, "docs", "specflow", "specs");
    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await mkdir(join(specsDir, "payment-flow"), { recursive: true });
    await writeFile(
      join(specsDir, "user-auth", ".specflow.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "created", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(
      join(specsDir, "payment-flow", ".specflow.json"),
      JSON.stringify({ version: 1, id: "FEAT-0002", slug: "payment-flow", status: "spec-ready", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(["node", "specflow", "list", "--status", "spec-ready"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).not.toContain("user-auth");
    expect(combined).toContain("payment-flow");
  });

  it("shows open fix count for features with fixes", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, "docs", "specflow", "specs");
    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await writeFile(
      join(specsDir, "user-auth", ".specflow.json"),
      JSON.stringify({
        version: 1,
        id: "FEAT-0001",
        slug: "user-auth",
        status: "in-progress",
        createdAt: "2026-05-21T00:00:00Z",
        updatedAt: "2026-05-21T00:00:00Z",
      }),
      "utf8",
    );

    const fixesDir = join(specsDir, "user-auth", "fixes");
    await mkdir(fixesDir, { recursive: true });
    await writeFile(
      join(fixesDir, "FIX-0001-token-expiry.md"),
      "---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n",
      "utf8",
    );
    await writeFile(
      join(fixesDir, "FIX-0002-null-pointer.md"),
      "---\nid: FIX-0002\nslug: null-pointer\nstatus: in-progress\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# null pointer\n",
      "utf8",
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(["node", "specflow", "list"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("user-auth");
    const lineWithFixes = combined.split("\n").find((l) => l.includes("user-auth"));
    expect(lineWithFixes).toBeDefined();
    const fixColumns = lineWithFixes!.split("\t");
    expect(fixColumns[3]).toBe("2 open fixes");
  });

  it("shows dash for features with no open fixes", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, "docs", "specflow", "specs");
    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await writeFile(
      join(specsDir, "user-auth", ".specflow.json"),
      JSON.stringify({
        version: 1,
        id: "FEAT-0001",
        slug: "user-auth",
        status: "in-progress",
        createdAt: "2026-05-21T00:00:00Z",
        updatedAt: "2026-05-21T00:00:00Z",
      }),
      "utf8",
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(["node", "specflow", "list"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("user-auth");
    const lineNoFixes = combined.split("\n").find((l) => l.includes("user-auth"));
    expect(lineNoFixes).toBeDefined();
    const noFixColumns = lineNoFixes!.split("\t");
    expect(noFixColumns[3]).toBe("-");
  });
});
