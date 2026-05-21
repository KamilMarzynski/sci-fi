import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBugFile, writeBugFile } from "../../../src/core/bugs/frontmatter.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe("writeBugFile / readBugFile", () => {
  it("round-trips a bug file with all optional fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-bug-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "BUG-0001-login-crash.md");

    await writeBugFile(filePath, {
      frontmatter: {
        id: "BUG-0001",
        slug: "login-crash",
        status: "open",
        severity: "high",
        "related-feature": "auth-flow",
        created: "2026-05-21T00:00:00.000Z",
      },
      body: "# login crash\n",
    });

    const result = await readBugFile(filePath);
    expect(result.frontmatter.id).toBe("BUG-0001");
    expect(result.frontmatter.slug).toBe("login-crash");
    expect(result.frontmatter.status).toBe("open");
    expect(result.frontmatter.severity).toBe("high");
    expect(result.frontmatter["related-feature"]).toBe("auth-flow");
    expect(result.frontmatter.created).toBe("2026-05-21T00:00:00.000Z");
    expect(result.body).toBe("# login crash\n");
  });

  it("round-trips a bug file with only required fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-bug-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "BUG-0002-null-ref.md");

    await writeBugFile(filePath, {
      frontmatter: {
        id: "BUG-0002",
        slug: "null-ref",
        status: "open",
        created: "2026-05-21T00:00:00.000Z",
      },
      body: "# null ref\n",
    });

    const result = await readBugFile(filePath);
    expect(result.frontmatter.id).toBe("BUG-0002");
    expect(result.frontmatter.slug).toBe("null-ref");
    expect(result.frontmatter.status).toBe("open");
    expect(result.frontmatter.created).toBe("2026-05-21T00:00:00.000Z");
    expect(result.frontmatter.severity).toBeUndefined();
    expect(result.frontmatter["related-feature"]).toBeUndefined();
  });

  it("throws on missing frontmatter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-bug-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "bad.md");

    await writeFile(filePath, "no frontmatter here\n", "utf8");

    await expect(readBugFile(filePath)).rejects.toThrow("missing YAML frontmatter");
  });

  it("throws when frontmatter is invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-bug-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "bad.md");

    await writeFile(filePath, "---\nfoo: bar\n---\nbody\n", "utf8");

    await expect(readBugFile(filePath)).rejects.toThrow("invalid frontmatter");
  });
});
