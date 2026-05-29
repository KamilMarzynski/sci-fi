import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../../../src/core/skills/catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = join(__dirname, "__fixtures__", "skills");

describe("loadCatalog", () => {
  it("loads each skills/<id>/{body.md,manifest.js} entry", async () => {
    const bundles = await loadCatalog({
      bodiesRoot: join(fixturesRoot, "good"),
      manifestsRoot: join(fixturesRoot, "good"),
    });

    const ids = bundles.map((bundle) => bundle.manifest.id).sort();
    expect(ids).toEqual(["sf-feature", "spec-review"]);

    const feature = bundles.find((bundle) => bundle.manifest.id === "sf-feature");
    expect(feature?.manifest.kind).toBe("user");
    expect(feature?.body).toBe("# sf-feature\n\nstub body\n");

    const review = bundles.find((bundle) => bundle.manifest.id === "spec-review");
    expect(review?.manifest.kind).toBe("subagent");
  });

  it("throws when manifest.id does not match the folder name", async () => {
    await expect(
      loadCatalog({
        bodiesRoot: join(fixturesRoot, "mismatch"),
        manifestsRoot: join(fixturesRoot, "mismatch"),
      }),
    ).rejects.toThrowError(/manifest.id "different-id" does not match folder "sf-feature"/);
  });

  it("throws when body.md is missing", async () => {
    await expect(
      loadCatalog({
        bodiesRoot: join(fixturesRoot, "missing-body"),
        manifestsRoot: join(fixturesRoot, "missing-body"),
      }),
    ).rejects.toThrowError(/body\.md/);
  });
});
