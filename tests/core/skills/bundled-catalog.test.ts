import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "../../../src/core/skills/catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..", "..", "..");

describe("bundled skill catalog", () => {
  it("loads exactly 10 skills with matching ids", async () => {
    const bundles = await loadCatalog({
      bodiesRoot: join(packageRoot, "skills"),
      manifestsRoot: join(packageRoot, "dist", "skills"),
    });

    const ids = bundles.map((bundle) => bundle.manifest.id).sort();

    expect(ids).toEqual([
      "sf-bug",
      "sf-code-review",
      "sf-feature",
      "sf-fix",
      "sf-implement",
      "sf-plan",
      "sf-plan-review",
      "sf-spec-review",
      "sf-tdd",
      "sf-verification",
    ]);
  });

  it("partitions 5 user skills and 5 subagents", async () => {
    const bundles = await loadCatalog({
      bodiesRoot: join(packageRoot, "skills"),
      manifestsRoot: join(packageRoot, "dist", "skills"),
    });

    const user = bundles.filter((bundle) => bundle.manifest.kind === "user");
    const subagent = bundles.filter(
      (bundle) => bundle.manifest.kind === "subagent",
    );

    expect(user.map((bundle) => bundle.manifest.id).sort()).toEqual([
      "sf-bug",
      "sf-feature",
      "sf-fix",
      "sf-implement",
      "sf-plan",
    ]);
    expect(subagent.map((bundle) => bundle.manifest.id).sort()).toEqual([
      "sf-code-review",
      "sf-plan-review",
      "sf-spec-review",
      "sf-tdd",
      "sf-verification",
    ]);
  });
});
