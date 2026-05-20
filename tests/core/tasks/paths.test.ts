import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTaskFilePath, buildTasksDirectoryPath } from "../../../src/core/tasks/paths.js";

describe("task path helpers", () => {
  it("places tasks/ under the feature directory", () => {
    expect(buildTasksDirectoryPath("/repo", "user-auth")).toBe(
      join("/repo", "docs", "specflow", "specs", "user-auth", "tasks"),
    );
  });

  it("builds task file path from task slug", () => {
    expect(buildTaskFilePath("/repo", "user-auth", "setup-database")).toBe(
      join("/repo", "docs", "specflow", "specs", "user-auth", "tasks", "setup-database.md"),
    );
  });
});
