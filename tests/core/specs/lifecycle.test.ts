import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectFeatureLifecycle,
  validateStatusTransition,
} from "../../../src/core/specs/lifecycle.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

describe("inspectFeatureLifecycle", () => {
  it("treats created plus spec.md as a draft awaiting acceptance", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-lifecycle-"));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, "docs", "specflow", "specs", "user-auth");

    await mkdir(featureRoot, { recursive: true });
    await writeFile(
      join(featureRoot, ".specflow.json"),
      JSON.stringify({
        version: 1,
        id: "FEAT-0001",
        slug: "user-auth",
        status: "created",
        createdAt: "2026-05-20T06:29:55Z",
        updatedAt: "2026-05-20T06:29:55Z",
      }) + "\n",
      "utf8",
    );
    await writeFile(join(featureRoot, "spec.md"), "# User Auth\n", "utf8");

    const lifecycle = await inspectFeatureLifecycle(projectRoot, "user-auth");

    expect(lifecycle.metadata.status).toBe("created");
    expect(lifecycle.artifacts.specExists).toBe(true);
    expect(lifecycle.artifacts.architectureExists).toBe(false);
    expect(lifecycle.artifacts.taskFileCount).toBe(0);
  });
});

describe("validateStatusTransition", () => {
  it("rejects plan-ready when architecture.md is missing", async () => {
    await expect(
      validateStatusTransition(
        {
          specExists: true,
          architectureExists: false,
          taskFileCount: 1,
        },
        "plan-ready",
      ),
    ).rejects.toThrow(
      "Cannot mark feature as plan-ready: architecture.md is missing.",
    );
  });
});
