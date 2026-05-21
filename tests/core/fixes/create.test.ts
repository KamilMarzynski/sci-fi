import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFix } from "../../../src/core/fixes/create.js";
import { readFixFile } from "../../../src/core/fixes/frontmatter.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
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

describe("createFix", () => {
  it("creates fixes/ dir and writes a fix file", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-create-"));
    temporaryDirectories.push(projectRoot);
    await scaffoldFeature(projectRoot, "auth-flow");

    const result = await createFix({
      projectRoot,
      description: "token expiry off by one",
      featureSlug: "auth-flow",
      now: "2026-05-21T00:00:00.000Z",
    });

    expect(result.id).toBe("FIX-0001");
    expect(result.filePath).toBe(
      join(
        projectRoot,
        "docs",
        "specflow",
        "specs",
        "auth-flow",
        "fixes",
        "FIX-0001-token-expiry-off-by-one.md",
      ),
    );

    const file = await readFixFile(result.filePath);
    expect(file.frontmatter.id).toBe("FIX-0001");
    expect(file.frontmatter.slug).toBe("token-expiry-off-by-one");
    expect(file.frontmatter.status).toBe("open");
    expect(file.frontmatter.feature).toBe("auth-flow");
    expect(file.body).toBe("# token expiry off by one\n");
  });

  it("assigns per-feature sequential IDs", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-create-"));
    temporaryDirectories.push(projectRoot);
    await scaffoldFeature(projectRoot, "auth-flow");
    await scaffoldFeature(projectRoot, "payments");

    const fix1 = await createFix({
      projectRoot,
      description: "first fix",
      featureSlug: "auth-flow",
      now: "2026-05-21T00:00:00.000Z",
    });
    const fix2 = await createFix({
      projectRoot,
      description: "second fix",
      featureSlug: "auth-flow",
      now: "2026-05-21T00:00:00.000Z",
    });
    const fix3 = await createFix({
      projectRoot,
      description: "first payments fix",
      featureSlug: "payments",
      now: "2026-05-21T00:00:00.000Z",
    });

    expect(fix1.id).toBe("FIX-0001");
    expect(fix2.id).toBe("FIX-0002");
    expect(fix3.id).toBe("FIX-0001");
  });

  it("throws when the feature does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-create-"));
    temporaryDirectories.push(projectRoot);

    await expect(
      createFix({
        projectRoot,
        description: "some fix",
        featureSlug: "nonexistent",
        now: "2026-05-21T00:00:00.000Z",
      }),
    ).rejects.toThrow('Feature "nonexistent" does not exist.');
  });
});
