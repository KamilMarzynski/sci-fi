import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTaskFile } from "../../src/core/tasks/frontmatter.js";
import { buildTaskFilePath } from "../../src/core/tasks/paths.js";
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

async function createTaskFile(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
  status: string,
): Promise<void> {
  const tasksDir = join(projectRoot, "docs", "specflow", "specs", featureSlug, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskSlug}.md`),
    `---\nid: TASK-001\nslug: ${taskSlug}\nstatus: ${status}\nparallel: false\ndepends-on: []\n---\n# ${taskSlug}\n`,
    "utf8",
  );
}

describe("task list", () => {
  it("prints all tasks for a feature", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");
    await createTaskFile(projectRoot, "user-auth", "implement-auth", "in-progress");

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(["node", "specflow", "task", "list", "user-auth"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("setup-database");
    expect(combined).toContain("pending");
    expect(combined).toContain("implement-auth");
    expect(combined).toContain("in-progress");
  });
});

describe("task start", () => {
  it("marks a task as in-progress", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");

    await buildProgram().parseAsync(["node", "specflow", "task", "start", "user-auth", "setup-database"]);

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe("in-progress");
  });
});

describe("task done", () => {
  it("marks an in-progress task as done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "in-progress");

    await buildProgram().parseAsync(["node", "specflow", "task", "done", "user-auth", "setup-database"]);

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe("done");
  });

  it("fails when task is not in-progress", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");

    await expect(
      buildProgram().parseAsync(["node", "specflow", "task", "done", "user-auth", "setup-database"]),
    ).rejects.toThrow("task is not in-progress");
  });
});
