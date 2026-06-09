# Spec Lifecycle Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9 new CLI commands and supporting core modules to drive the scifi feature lifecycle from `created` through `done`, with per-task status tracking via YAML frontmatter in individual task `.md` files.

**Architecture:** All new commands stay thin — argument parsing and stdout output only. Business logic lives in new `src/core/tasks/` and additions to `src/core/specs/`. Task status is stored as YAML frontmatter directly in each `tasks/<slug>.md` file. The `yaml` npm package (ESM-native) handles frontmatter parsing and serialization.

**Tech Stack:** TypeScript (strict, NodeNext ESM), Commander.js, vitest, `yaml` (YAML parsing/serialization).

---

## File Map

**New source files:**
- `src/core/tasks/types.ts` — TaskStatus, TaskFrontmatter
- `src/core/tasks/paths.ts` — buildTasksDirectoryPath, buildTaskFilePath
- `src/core/tasks/frontmatter.ts` — readTaskFile, writeTaskFile
- `src/core/tasks/list.ts` — listTasks
- `src/core/tasks/transition.ts` — updateTaskStatus
- `src/core/specs/list.ts` — listFeatures
- `src/core/specs/transition.ts` — updateFeatureStatus
- `src/cli/commands/spec-ready.ts`
- `src/cli/commands/plan-ready.ts`
- `src/cli/commands/start.ts`
- `src/cli/commands/finish.ts`
- `src/cli/commands/list.ts`
- `src/cli/commands/status.ts`
- `src/cli/commands/task.ts`

**New test files:**
- `tests/core/tasks/paths.test.ts`
- `tests/core/tasks/frontmatter.test.ts`
- `tests/core/tasks/list.test.ts`
- `tests/core/tasks/transition.test.ts`
- `tests/core/specs/list.test.ts`
- `tests/core/specs/transition.test.ts`
- `tests/cli/spec-ready.test.ts`
- `tests/cli/plan-ready.test.ts`
- `tests/cli/start.test.ts`
- `tests/cli/finish.test.ts`
- `tests/cli/list.test.ts`
- `tests/cli/status.test.ts`
- `tests/cli/task.test.ts`
- `tests/e2e/installed-lifecycle.test.ts`

**Modified files:**
- `package.json` — add `yaml` production dependency
- `src/core/specs/lifecycle.ts` — extend validateStatusTransition with optional context param
- `src/cli/index.ts` — register all new commands
- `tests/core/specs/lifecycle.test.ts` — add tests for new transition rules
- `tests/cli/index.test.ts` — verify all new commands are registered

---

## Task 1: Install yaml dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install yaml**

```bash
npm install yaml
```

- [ ] **Step 2: Verify dependency added**

```bash
node -e "import('yaml').then(m => console.log(typeof m.parse))"
```

Expected output: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add yaml dependency for task frontmatter parsing"
```

---

## Task 2: Task types and path helpers

**Files:**
- Create: `src/core/tasks/types.ts`
- Create: `src/core/tasks/paths.ts`
- Create: `tests/core/tasks/paths.test.ts`

- [ ] **Step 1: Write the failing path test**

Create `tests/core/tasks/paths.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTaskFilePath, buildTasksDirectoryPath } from "../../../src/core/tasks/paths.js";

describe("task path helpers", () => {
  it("places tasks/ under the feature directory", () => {
    expect(buildTasksDirectoryPath("/repo", "user-auth")).toBe(
      join("/repo", "docs", "scifi", "specs", "user-auth", "tasks"),
    );
  });

  it("builds task file path from task slug", () => {
    expect(buildTaskFilePath("/repo", "user-auth", "setup-database")).toBe(
      join("/repo", "docs", "scifi", "specs", "user-auth", "tasks", "setup-database.md"),
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/core/tasks/paths.test.ts
```

Expected: fail with import errors (files don't exist yet).

- [ ] **Step 3: Create task types**

Create `src/core/tasks/types.ts`:

```ts
export const TASK_STATUS_VALUES = [
  "pending",
  "in-progress",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export interface TaskFrontmatter {
  id: string;
  slug: string;
  status: TaskStatus;
  parallel: boolean;
  dependsOn: string[];
}
```

- [ ] **Step 4: Create path helpers**

Create `src/core/tasks/paths.ts`:

```ts
import { join } from "node:path";
import { buildFeatureDirectoryPath } from "../specs/paths.js";

export function buildTasksDirectoryPath(
  projectRoot: string,
  featureSlug: string,
): string {
  return join(buildFeatureDirectoryPath(projectRoot, featureSlug), "tasks");
}

export function buildTaskFilePath(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
): string {
  return join(buildTasksDirectoryPath(projectRoot, featureSlug), `${taskSlug}.md`);
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test -- tests/core/tasks/paths.test.ts
```

Expected: PASS

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/core/tasks/types.ts src/core/tasks/paths.ts tests/core/tasks/paths.test.ts
git commit -m "feat: add task types and path helpers"
```

---

## Task 3: Task frontmatter read/write

**Files:**
- Create: `src/core/tasks/frontmatter.ts`
- Create: `tests/core/tasks/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/tasks/frontmatter.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTaskFile, writeTaskFile } from "../../../src/core/tasks/frontmatter.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe("readTaskFile", () => {
  it("parses frontmatter and body from a task file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scifi-frontmatter-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "setup-database.md");

    await writeFile(
      filePath,
      `---\nid: TASK-001\nslug: setup-database\nstatus: pending\nparallel: false\ndepends-on: []\n---\n# Setup Database\n\nCreate the schema.\n`,
      "utf8",
    );

    const file = await readTaskFile(filePath);

    expect(file.frontmatter).toEqual({
      id: "TASK-001",
      slug: "setup-database",
      status: "pending",
      parallel: false,
      dependsOn: [],
    });
    expect(file.body).toBe("# Setup Database\n\nCreate the schema.\n");
  });

  it("parses depends-on entries as dependsOn array", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scifi-frontmatter-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "task.md");

    await writeFile(
      filePath,
      `---\nid: TASK-002\nslug: task\nstatus: pending\nparallel: false\ndepends-on:\n  - setup-database\n---\nbody\n`,
      "utf8",
    );

    const file = await readTaskFile(filePath);
    expect(file.frontmatter.dependsOn).toEqual(["setup-database"]);
  });

  it("throws when frontmatter is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scifi-frontmatter-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "task.md");

    await writeFile(filePath, "# Just a title\n", "utf8");

    await expect(readTaskFile(filePath)).rejects.toThrow("missing YAML frontmatter");
  });

  it("throws when frontmatter is invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scifi-frontmatter-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "task.md");

    await writeFile(filePath, "---\nfoo: bar\n---\nbody\n", "utf8");

    await expect(readTaskFile(filePath)).rejects.toThrow("invalid frontmatter");
  });
});

describe("writeTaskFile", () => {
  it("writes frontmatter and body to file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scifi-frontmatter-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "task.md");

    await writeTaskFile(filePath, {
      frontmatter: {
        id: "TASK-001",
        slug: "setup-database",
        status: "in-progress",
        parallel: false,
        dependsOn: [],
      },
      body: "# Setup Database\n",
    });

    const readBack = await readTaskFile(filePath);
    expect(readBack.frontmatter.status).toBe("in-progress");
    expect(readBack.frontmatter.id).toBe("TASK-001");
    expect(readBack.body).toBe("# Setup Database\n");
  });

  it("round-trips depends-on through write and read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scifi-frontmatter-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "task.md");

    await writeTaskFile(filePath, {
      frontmatter: {
        id: "TASK-002",
        slug: "implement-auth",
        status: "pending",
        parallel: true,
        dependsOn: ["setup-database"],
      },
      body: "body\n",
    });

    const readBack = await readTaskFile(filePath);
    expect(readBack.frontmatter.dependsOn).toEqual(["setup-database"]);
    expect(readBack.frontmatter.parallel).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/core/tasks/frontmatter.test.ts
```

Expected: fail with import errors.

- [ ] **Step 3: Implement frontmatter module**

Create `src/core/tasks/frontmatter.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { TASK_STATUS_VALUES, type TaskFrontmatter } from "./types.js";

export interface TaskFile {
  frontmatter: TaskFrontmatter;
  body: string;
}

function isValidTaskStatus(value: unknown): value is TaskFrontmatter["status"] {
  return (
    typeof value === "string" &&
    (TASK_STATUS_VALUES as readonly string[]).includes(value)
  );
}

function isValidRawFrontmatter(
  raw: unknown,
): raw is Record<string, unknown> & {
  id: string;
  slug: string;
  status: string;
  parallel: boolean;
  "depends-on": unknown[];
} {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["slug"] === "string" &&
    isValidTaskStatus(obj["status"]) &&
    typeof obj["parallel"] === "boolean" &&
    Array.isArray(obj["depends-on"])
  );
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export async function readTaskFile(filePath: string): Promise<TaskFile> {
  const content = await readFile(filePath, "utf8");
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    throw new Error(`Task file at ${filePath} is missing YAML frontmatter.`);
  }

  const yamlPart = match[1] ?? "";
  const body = match[2] ?? "";
  const raw = parseYaml(yamlPart);

  if (!isValidRawFrontmatter(raw)) {
    throw new Error(`Task file at ${filePath} has invalid frontmatter.`);
  }

  const dependsOnRaw = raw["depends-on"];

  return {
    frontmatter: {
      id: raw.id,
      slug: raw.slug,
      status: raw.status as TaskFrontmatter["status"],
      parallel: raw.parallel,
      dependsOn: dependsOnRaw.filter((v): v is string => typeof v === "string"),
    },
    body,
  };
}

export async function writeTaskFile(filePath: string, file: TaskFile): Promise<void> {
  const rawFrontmatter: Record<string, unknown> = {
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    status: file.frontmatter.status,
    parallel: file.frontmatter.parallel,
  };
  rawFrontmatter["depends-on"] = file.frontmatter.dependsOn;

  const content = `---\n${stringifyYaml(rawFrontmatter)}---\n${file.body}`;
  await writeFile(filePath, content, "utf8");
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/core/tasks/frontmatter.test.ts
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/core/tasks/frontmatter.ts tests/core/tasks/frontmatter.test.ts
git commit -m "feat: add task frontmatter read/write"
```

---

## Task 4: List tasks

**Files:**
- Create: `src/core/tasks/list.ts`
- Create: `tests/core/tasks/list.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/tasks/list.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listTasks } from "../../../src/core/tasks/list.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

function makeTaskContent(slug: string, status: string, parallel = false): string {
  return `---\nid: TASK-001\nslug: ${slug}\nstatus: ${status}\nparallel: ${String(parallel)}\ndepends-on: []\n---\n# ${slug}\n`;
}

describe("listTasks", () => {
  it("returns empty array when tasks/ directory does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-tasks-"));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    await mkdir(featureRoot, { recursive: true });

    const tasks = await listTasks(projectRoot, "user-auth");
    expect(tasks).toEqual([]);
  });

  it("returns frontmatter for each .md file in tasks/", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-tasks-"));
    temporaryDirectories.push(projectRoot);
    const tasksDir = join(projectRoot, "docs", "scifi", "specs", "user-auth", "tasks");
    await mkdir(tasksDir, { recursive: true });

    await writeFile(join(tasksDir, "setup-database.md"), makeTaskContent("setup-database", "pending"), "utf8");
    await writeFile(join(tasksDir, "implement-auth.md"), makeTaskContent("implement-auth", "in-progress"), "utf8");

    const tasks = await listTasks(projectRoot, "user-auth");
    expect(tasks).toHaveLength(2);

    const slugs = tasks.map((t) => t.slug).sort();
    expect(slugs).toEqual(["implement-auth", "setup-database"]);
  });

  it("ignores non-.md files in tasks/", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-tasks-"));
    temporaryDirectories.push(projectRoot);
    const tasksDir = join(projectRoot, "docs", "scifi", "specs", "user-auth", "tasks");
    await mkdir(tasksDir, { recursive: true });

    await writeFile(join(tasksDir, "setup-database.md"), makeTaskContent("setup-database", "pending"), "utf8");
    await writeFile(join(tasksDir, "notes.txt"), "ignore me", "utf8");

    const tasks = await listTasks(projectRoot, "user-auth");
    expect(tasks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/core/tasks/list.test.ts
```

Expected: fail with import errors.

- [ ] **Step 3: Implement listTasks**

Create `src/core/tasks/list.ts`:

```ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readTaskFile } from "./frontmatter.js";
import { buildTasksDirectoryPath } from "./paths.js";
import type { TaskFrontmatter } from "./types.js";

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function listTasks(
  projectRoot: string,
  featureSlug: string,
): Promise<TaskFrontmatter[]> {
  const tasksDir = buildTasksDirectoryPath(projectRoot, featureSlug);

  const entries = await readdir(tasksDir, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissingPathError(error)) return [];
      throw error;
    },
  );

  const taskFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".md"),
  );

  return Promise.all(
    taskFiles.map((entry) =>
      readTaskFile(join(tasksDir, entry.name)).then((file) => file.frontmatter),
    ),
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/core/tasks/list.test.ts
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/core/tasks/list.ts tests/core/tasks/list.test.ts
git commit -m "feat: add listTasks core function"
```

---

## Task 5: Update task status

**Files:**
- Create: `src/core/tasks/transition.ts`
- Create: `tests/core/tasks/transition.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/tasks/transition.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTaskFile } from "../../../src/core/tasks/frontmatter.js";
import { buildTaskFilePath } from "../../../src/core/tasks/paths.js";
import { updateTaskStatus } from "../../../src/core/tasks/transition.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
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
  const tasksDir = join(projectRoot, "docs", "scifi", "specs", featureSlug, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskSlug}.md`),
    `---\nid: TASK-001\nslug: ${taskSlug}\nstatus: ${status}\nparallel: false\ndepends-on: []\n---\n# ${taskSlug}\n`,
    "utf8",
  );
}

describe("updateTaskStatus", () => {
  it("marks a pending task as in-progress", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-transition-"));
    temporaryDirectories.push(projectRoot);
    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");

    await updateTaskStatus(projectRoot, "user-auth", "setup-database", "in-progress");

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe("in-progress");
  });

  it("marks an in-progress task as done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-transition-"));
    temporaryDirectories.push(projectRoot);
    await createTaskFile(projectRoot, "user-auth", "setup-database", "in-progress");

    await updateTaskStatus(projectRoot, "user-auth", "setup-database", "done");

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe("done");
  });

  it("preserves body content when updating status", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-transition-"));
    temporaryDirectories.push(projectRoot);
    const tasksDir = join(projectRoot, "docs", "scifi", "specs", "user-auth", "tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "setup-database.md"),
      `---\nid: TASK-001\nslug: setup-database\nstatus: pending\nparallel: false\ndepends-on: []\n---\n# Setup Database\n\nDetailed description.\n`,
      "utf8",
    );

    await updateTaskStatus(projectRoot, "user-auth", "setup-database", "in-progress");

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.body).toBe("# Setup Database\n\nDetailed description.\n");
  });

  it("rejects marking a pending task as done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-transition-"));
    temporaryDirectories.push(projectRoot);
    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");

    await expect(
      updateTaskStatus(projectRoot, "user-auth", "setup-database", "done"),
    ).rejects.toThrow("task is not in-progress");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/core/tasks/transition.test.ts
```

Expected: fail with import errors.

- [ ] **Step 3: Implement updateTaskStatus**

Create `src/core/tasks/transition.ts`:

```ts
import { readTaskFile, writeTaskFile } from "./frontmatter.js";
import { buildTaskFilePath } from "./paths.js";
import type { TaskStatus } from "./types.js";

export async function updateTaskStatus(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
  targetStatus: TaskStatus,
): Promise<void> {
  const filePath = buildTaskFilePath(projectRoot, featureSlug, taskSlug);
  const file = await readTaskFile(filePath);

  if (targetStatus === "done" && file.frontmatter.status !== "in-progress") {
    throw new Error(
      `Cannot mark task ${taskSlug} as done: task is not in-progress (current status: ${file.frontmatter.status}).`,
    );
  }

  await writeTaskFile(filePath, {
    ...file,
    frontmatter: { ...file.frontmatter, status: targetStatus },
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/core/tasks/transition.test.ts
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/core/tasks/transition.ts tests/core/tasks/transition.test.ts
git commit -m "feat: add updateTaskStatus core function"
```

---

## Task 6: Extend lifecycle validation for `in-progress` and `done`

**Files:**
- Modify: `src/core/specs/lifecycle.ts`
- Modify: `tests/core/specs/lifecycle.test.ts`

- [ ] **Step 1: Add new test cases to lifecycle.test.ts**

Append to `tests/core/specs/lifecycle.test.ts` (after the existing `validateStatusTransition` describe block):

```ts
describe("validateStatusTransition with context", () => {
  it("rejects in-progress when current status is not plan-ready", async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, architectureExists: true, taskFileCount: 1 },
        "in-progress",
        { currentStatus: "spec-ready" },
      ),
    ).rejects.toThrow(
      "Cannot start feature: feature must be plan-ready before starting implementation.",
    );
  });

  it("accepts in-progress when current status is plan-ready", async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, architectureExists: true, taskFileCount: 1 },
        "in-progress",
        { currentStatus: "plan-ready" },
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects done when allTasksDone is false", async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, architectureExists: true, taskFileCount: 1 },
        "done",
        { allTasksDone: false },
      ),
    ).rejects.toThrow(
      "Cannot mark feature as done: not all tasks are complete.",
    );
  });

  it("accepts done when allTasksDone is true", async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, architectureExists: true, taskFileCount: 1 },
        "done",
        { allTasksDone: true },
      ),
    ).resolves.toBeUndefined();
  });

  it("does not apply in-progress rule when context is absent", async () => {
    await expect(
      validateStatusTransition(
        { specExists: false, architectureExists: false, taskFileCount: 0 },
        "in-progress",
      ),
    ).resolves.toBeUndefined();
  });

  it("does not apply done rule when context is absent", async () => {
    await expect(
      validateStatusTransition(
        { specExists: false, architectureExists: false, taskFileCount: 0 },
        "done",
      ),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
npm test -- tests/core/specs/lifecycle.test.ts
```

Expected: new tests fail, existing tests still pass.

- [ ] **Step 3: Extend validateStatusTransition**

In `src/core/specs/lifecycle.ts`, update the `validateStatusTransition` signature and add new rules:

```ts
import type { FeatureStatus } from "./types.js";

interface ValidationContext {
  currentStatus?: FeatureStatus;
  allTasksDone?: boolean;
}

export async function validateStatusTransition(
  artifacts: FeatureArtifacts,
  targetStatus: FeatureStatus,
  context?: ValidationContext,
): Promise<void> {
  if (targetStatus === "spec-ready" && !artifacts.specExists) {
    throw new Error("Cannot mark feature as spec-ready: spec.md is missing.");
  }

  if (targetStatus === "plan-ready") {
    if (!artifacts.architectureExists) {
      throw new Error("Cannot mark feature as plan-ready: architecture.md is missing.");
    }
    if (artifacts.taskFileCount < 1) {
      throw new Error("Cannot mark feature as plan-ready: no task files were found.");
    }
  }

  if (
    targetStatus === "in-progress" &&
    context?.currentStatus !== undefined &&
    context.currentStatus !== "plan-ready"
  ) {
    throw new Error(
      "Cannot start feature: feature must be plan-ready before starting implementation.",
    );
  }

  if (targetStatus === "done" && context?.allTasksDone === false) {
    throw new Error(
      "Cannot mark feature as done: not all tasks are complete.",
    );
  }
}
```

- [ ] **Step 4: Run all lifecycle tests to confirm they pass**

```bash
npm test -- tests/core/specs/lifecycle.test.ts
```

Expected: all tests PASS including new ones.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/core/specs/lifecycle.ts tests/core/specs/lifecycle.test.ts
git commit -m "feat: extend validateStatusTransition with in-progress and done rules"
```

---

## Task 7: listFeatures core function

**Files:**
- Create: `src/core/specs/list.ts`
- Create: `tests/core/specs/list.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/specs/list.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listFeatures } from "../../../src/core/specs/list.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

function makeMetadata(slug: string, id: string, status: string): string {
  return JSON.stringify(
    { version: 1, id, slug, status, createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" },
    null,
    2,
  ) + "\n";
}

describe("listFeatures", () => {
  it("returns empty array when specs directory does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-"));
    temporaryDirectories.push(projectRoot);

    const features = await listFeatures({ projectRoot });
    expect(features).toEqual([]);
  });

  it("returns metadata for all feature directories", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-"));
    temporaryDirectories.push(projectRoot);
    const specsDir = join(projectRoot, "docs", "scifi", "specs");

    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await mkdir(join(specsDir, "payment-flow"), { recursive: true });
    await writeFile(join(specsDir, "user-auth", ".scifi.json"), makeMetadata("user-auth", "FEAT-0001", "created"), "utf8");
    await writeFile(join(specsDir, "payment-flow", ".scifi.json"), makeMetadata("payment-flow", "FEAT-0002", "spec-ready"), "utf8");

    const features = await listFeatures({ projectRoot });
    expect(features).toHaveLength(2);

    const slugs = features.map((f) => f.slug).sort();
    expect(slugs).toEqual(["payment-flow", "user-auth"]);
  });

  it("filters features by status", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-"));
    temporaryDirectories.push(projectRoot);
    const specsDir = join(projectRoot, "docs", "scifi", "specs");

    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await mkdir(join(specsDir, "payment-flow"), { recursive: true });
    await writeFile(join(specsDir, "user-auth", ".scifi.json"), makeMetadata("user-auth", "FEAT-0001", "created"), "utf8");
    await writeFile(join(specsDir, "payment-flow", ".scifi.json"), makeMetadata("payment-flow", "FEAT-0002", "spec-ready"), "utf8");

    const features = await listFeatures({ projectRoot, status: "spec-ready" });
    expect(features).toHaveLength(1);
    expect(features[0]?.slug).toBe("payment-flow");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/core/specs/list.test.ts
```

Expected: fail with import errors.

- [ ] **Step 3: Implement listFeatures**

Create `src/core/specs/list.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import { buildFeaturesRootPath, buildFeatureMetadataPath } from "./paths.js";
import type { FeatureMetadata, FeatureStatus } from "./types.js";

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isValidFeatureMetadata(value: unknown): value is FeatureMetadata {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    "version" in obj &&
    typeof obj["version"] === "number" &&
    "id" in obj &&
    typeof obj["id"] === "string" &&
    "slug" in obj &&
    typeof obj["slug"] === "string" &&
    "status" in obj &&
    typeof obj["status"] === "string" &&
    "createdAt" in obj &&
    typeof obj["createdAt"] === "string" &&
    "updatedAt" in obj &&
    typeof obj["updatedAt"] === "string"
  );
}

export interface ListFeaturesOptions {
  projectRoot: string;
  status?: FeatureStatus;
}

export async function listFeatures(
  options: ListFeaturesOptions,
): Promise<FeatureMetadata[]> {
  const { projectRoot, status } = options;
  const specsRoot = buildFeaturesRootPath(projectRoot);

  const entries = await readdir(specsRoot, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissingPathError(error)) return [];
      throw error;
    },
  );

  const featureDirs = entries.filter((entry) => entry.isDirectory());

  const allResults = await Promise.all(
    featureDirs.map(async (dir) => {
      const metadataPath = buildFeatureMetadataPath(projectRoot, dir.name);
      const raw = JSON.parse(await readFile(metadataPath, "utf8")) as unknown;
      if (!isValidFeatureMetadata(raw)) return null;
      return raw;
    }),
  );

  const features = allResults.filter((m): m is FeatureMetadata => m !== null);

  if (status !== undefined) {
    return features.filter((f) => f.status === status);
  }

  return features;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/core/specs/list.test.ts
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/core/specs/list.ts tests/core/specs/list.test.ts
git commit -m "feat: add listFeatures core function"
```

---

## Task 8: Feature status transition

**Files:**
- Create: `src/core/specs/transition.ts`
- Create: `tests/core/specs/transition.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/specs/transition.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { updateFeatureStatus } from "../../../src/core/specs/transition.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

async function createFeatureAt(
  projectRoot: string,
  slug: string,
  status: string,
): Promise<void> {
  const featureDir = join(projectRoot, "docs", "scifi", "specs", slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, ".scifi.json"),
    JSON.stringify(
      { version: 1, id: "FEAT-0001", slug, status, createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

async function writeSpecMd(projectRoot: string, slug: string): Promise<void> {
  await writeFile(join(projectRoot, "docs", "scifi", "specs", slug, "spec.md"), "# Spec\n", "utf8");
}

async function writeArchitectureMd(projectRoot: string, slug: string): Promise<void> {
  await writeFile(join(projectRoot, "docs", "scifi", "specs", slug, "architecture.md"), "# Architecture\n", "utf8");
}

async function writeTaskMd(projectRoot: string, slug: string, taskSlug: string, taskStatus: string): Promise<void> {
  const tasksDir = join(projectRoot, "docs", "scifi", "specs", slug, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskSlug}.md`),
    `---\nid: TASK-001\nslug: ${taskSlug}\nstatus: ${taskStatus}\nparallel: false\ndepends-on: []\n---\n# ${taskSlug}\n`,
    "utf8",
  );
}

describe("updateFeatureStatus", () => {
  it("transitions created to spec-ready when spec.md exists", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-transition-"));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, "user-auth", "created");
    await writeSpecMd(projectRoot, "user-auth");

    await updateFeatureStatus(projectRoot, "user-auth", "spec-ready", "2026-05-20T10:00:00Z");

    const metadata = JSON.parse(
      await readFile(join(projectRoot, "docs", "scifi", "specs", "user-auth", ".scifi.json"), "utf8"),
    ) as { status: string; updatedAt: string };
    expect(metadata.status).toBe("spec-ready");
    expect(metadata.updatedAt).toBe("2026-05-20T10:00:00Z");
  });

  it("transitions plan-ready to in-progress", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-transition-"));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, "user-auth", "plan-ready");
    await writeSpecMd(projectRoot, "user-auth");
    await writeArchitectureMd(projectRoot, "user-auth");
    await writeTaskMd(projectRoot, "user-auth", "setup-db", "pending");

    await updateFeatureStatus(projectRoot, "user-auth", "in-progress", "2026-05-20T10:00:00Z");

    const metadata = JSON.parse(
      await readFile(join(projectRoot, "docs", "scifi", "specs", "user-auth", ".scifi.json"), "utf8"),
    ) as { status: string };
    expect(metadata.status).toBe("in-progress");
  });

  it("transitions in-progress to done when all tasks are done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-transition-"));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, "user-auth", "in-progress");
    await writeSpecMd(projectRoot, "user-auth");
    await writeArchitectureMd(projectRoot, "user-auth");
    await writeTaskMd(projectRoot, "user-auth", "setup-db", "done");

    await updateFeatureStatus(projectRoot, "user-auth", "done", "2026-05-20T10:00:00Z");

    const metadata = JSON.parse(
      await readFile(join(projectRoot, "docs", "scifi", "specs", "user-auth", ".scifi.json"), "utf8"),
    ) as { status: string };
    expect(metadata.status).toBe("done");
  });

  it("rejects spec-ready when spec.md is missing", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-transition-"));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, "user-auth", "created");

    await expect(
      updateFeatureStatus(projectRoot, "user-auth", "spec-ready", "2026-05-20T10:00:00Z"),
    ).rejects.toThrow("spec.md is missing");
  });

  it("rejects in-progress when feature is not plan-ready", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-transition-"));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, "user-auth", "spec-ready");
    await writeSpecMd(projectRoot, "user-auth");

    await expect(
      updateFeatureStatus(projectRoot, "user-auth", "in-progress", "2026-05-20T10:00:00Z"),
    ).rejects.toThrow("must be plan-ready");
  });

  it("rejects done when a task is not done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-transition-"));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, "user-auth", "in-progress");
    await writeSpecMd(projectRoot, "user-auth");
    await writeArchitectureMd(projectRoot, "user-auth");
    await writeTaskMd(projectRoot, "user-auth", "setup-db", "in-progress");

    await expect(
      updateFeatureStatus(projectRoot, "user-auth", "done", "2026-05-20T10:00:00Z"),
    ).rejects.toThrow("not all tasks are complete");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/core/specs/transition.test.ts
```

Expected: fail with import errors.

- [ ] **Step 3: Implement updateFeatureStatus**

Create `src/core/specs/transition.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { listTasks } from "../tasks/list.js";
import { buildFeatureMetadataPath } from "./paths.js";
import { inspectFeatureLifecycle, validateStatusTransition } from "./lifecycle.js";
import type { FeatureMetadata, FeatureStatus } from "./types.js";

export async function updateFeatureStatus(
  projectRoot: string,
  slug: string,
  targetStatus: FeatureStatus,
  now: string,
): Promise<void> {
  const lifecycle = await inspectFeatureLifecycle(projectRoot, slug);
  const tasks = await listTasks(projectRoot, slug);
  const allTasksDone =
    tasks.length > 0 && tasks.every((t) => t.status === "done");

  await validateStatusTransition(lifecycle.artifacts, targetStatus, {
    currentStatus: lifecycle.metadata.status,
    allTasksDone,
  });

  const metadata = lifecycle.metadata;
  const updatedMetadata: FeatureMetadata = {
    version: metadata.version,
    id: metadata.id,
    slug: metadata.slug,
    ...(metadata.title !== undefined && { title: metadata.title }),
    status: targetStatus,
    createdAt: metadata.createdAt,
    updatedAt: now,
  };

  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);
  await writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2) + "\n", "utf8");
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/core/specs/transition.test.ts
```

Expected: PASS

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/core/specs/transition.ts tests/core/specs/transition.test.ts
git commit -m "feat: add updateFeatureStatus core function"
```

---

## Task 9: spec-ready command

**Files:**
- Create: `src/cli/commands/spec-ready.ts`
- Create: `tests/cli/spec-ready.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/spec-ready.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("spec-ready command", () => {
  it("transitions feature to spec-ready when spec.md exists", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-spec-ready-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "created", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");

    await buildProgram().parseAsync(["node", "scifi", "spec-ready", "user-auth"]);

    const metadata = JSON.parse(await readFile(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
    expect(metadata.status).toBe("spec-ready");
  });

  it("fails when spec.md is missing", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-spec-ready-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "created", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );

    await expect(
      buildProgram().parseAsync(["node", "scifi", "spec-ready", "user-auth"]),
    ).rejects.toThrow("spec.md is missing");
  });
});
```

Add to the `buildProgram` describe block in `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("spec-ready");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/spec-ready.test.ts tests/cli/index.test.ts
```

Expected: spec-ready tests fail with import errors, index test fails on missing `spec-ready` command.

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/spec-ready.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerSpecReadyCommand(program: Command): void {
  program
    .command("spec-ready")
    .description("Mark a feature as spec-ready (validates spec.md exists)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "spec-ready", createTimestamp());
      process.stdout.write(`feature ${slug} marked as spec-ready\n`);
    });
}
```

- [ ] **Step 4: Register command in index.ts**

In `src/cli/index.ts`, add:

```ts
import { registerSpecReadyCommand } from "./commands/spec-ready.js";
```

And inside `buildProgram()`:

```ts
registerSpecReadyCommand(program);
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- tests/cli/spec-ready.test.ts tests/cli/index.test.ts
```

Expected: PASS

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/spec-ready.ts src/cli/index.ts tests/cli/spec-ready.test.ts tests/cli/index.test.ts
git commit -m "feat: add spec-ready command"
```

---

## Task 10: plan-ready command

**Files:**
- Create: `src/cli/commands/plan-ready.ts`
- Create: `tests/cli/plan-ready.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/plan-ready.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function scaffoldFeature(projectRoot: string, slug: string, status: string): Promise<string> {
  const featureDir = join(projectRoot, "docs", "scifi", "specs", slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, ".scifi.json"),
    JSON.stringify({ version: 1, id: "FEAT-0001", slug, status, createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
    "utf8",
  );
  return featureDir;
}

describe("plan-ready command", () => {
  it("transitions feature to plan-ready when architecture.md and tasks exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-plan-ready-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = await scaffoldFeature(projectRoot, "user-auth", "spec-ready");
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");
    await writeFile(join(featureDir, "architecture.md"), "# Architecture\n", "utf8");
    const tasksDir = join(featureDir, "tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "setup-db.md"),
      "---\nid: TASK-001\nslug: setup-db\nstatus: pending\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
      "utf8",
    );

    await buildProgram().parseAsync(["node", "scifi", "plan-ready", "user-auth"]);

    const metadata = JSON.parse(await readFile(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
    expect(metadata.status).toBe("plan-ready");
  });

  it("fails when architecture.md is missing", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-plan-ready-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = await scaffoldFeature(projectRoot, "user-auth", "spec-ready");
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");
    const tasksDir = join(featureDir, "tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "setup-db.md"),
      "---\nid: TASK-001\nslug: setup-db\nstatus: pending\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
      "utf8",
    );

    await expect(
      buildProgram().parseAsync(["node", "scifi", "plan-ready", "user-auth"]),
    ).rejects.toThrow("architecture.md is missing");
  });

  it("fails when no task files exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-plan-ready-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = await scaffoldFeature(projectRoot, "user-auth", "spec-ready");
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");
    await writeFile(join(featureDir, "architecture.md"), "# Architecture\n", "utf8");

    await expect(
      buildProgram().parseAsync(["node", "scifi", "plan-ready", "user-auth"]),
    ).rejects.toThrow("no task files were found");
  });
});
```

Add to `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("plan-ready");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/plan-ready.test.ts tests/cli/index.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/plan-ready.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerPlanReadyCommand(program: Command): void {
  program
    .command("plan-ready")
    .description("Mark a feature as plan-ready (validates architecture.md and tasks/ exist)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "plan-ready", createTimestamp());
      process.stdout.write(`feature ${slug} marked as plan-ready\n`);
    });
}
```

- [ ] **Step 4: Register in index.ts**

In `src/cli/index.ts`:

```ts
import { registerPlanReadyCommand } from "./commands/plan-ready.js";
```

Inside `buildProgram()`:

```ts
registerPlanReadyCommand(program);
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- tests/cli/plan-ready.test.ts tests/cli/index.test.ts
```

Expected: PASS

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/plan-ready.ts src/cli/index.ts tests/cli/plan-ready.test.ts tests/cli/index.test.ts
git commit -m "feat: add plan-ready command"
```

---

## Task 11: start command

**Files:**
- Create: `src/cli/commands/start.ts`
- Create: `tests/cli/start.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/start.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("start command", () => {
  it("transitions plan-ready feature to in-progress", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-start-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "plan-ready", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");
    await writeFile(join(featureDir, "architecture.md"), "# Architecture\n", "utf8");
    const tasksDir = join(featureDir, "tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, "setup-db.md"),
      "---\nid: TASK-001\nslug: setup-db\nstatus: pending\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
      "utf8",
    );

    await buildProgram().parseAsync(["node", "scifi", "start", "user-auth"]);

    const metadata = JSON.parse(await readFile(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
    expect(metadata.status).toBe("in-progress");
  });

  it("fails when feature is not plan-ready", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-start-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "spec-ready", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");

    await expect(
      buildProgram().parseAsync(["node", "scifi", "start", "user-auth"]),
    ).rejects.toThrow("must be plan-ready");
  });
});
```

Add to `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("start");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/start.test.ts tests/cli/index.test.ts
```

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/start.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Mark a feature as in-progress (requires plan-ready status)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "in-progress", createTimestamp());
      process.stdout.write(`feature ${slug} marked as in-progress\n`);
    });
}
```

- [ ] **Step 4: Register in index.ts**

```ts
import { registerStartCommand } from "./commands/start.js";
// inside buildProgram():
registerStartCommand(program);
```

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npm test -- tests/cli/start.test.ts tests/cli/index.test.ts
npm run typecheck
git add src/cli/commands/start.ts src/cli/index.ts tests/cli/start.test.ts tests/cli/index.test.ts
git commit -m "feat: add start command"
```

---

## Task 12: finish command

**Files:**
- Create: `src/cli/commands/finish.ts`
- Create: `tests/cli/finish.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/finish.test.ts`:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function scaffoldInProgressFeature(projectRoot: string): Promise<string> {
  const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
  const tasksDir = join(featureDir, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(featureDir, ".scifi.json"),
    JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "in-progress", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
    "utf8",
  );
  await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");
  await writeFile(join(featureDir, "architecture.md"), "# Architecture\n", "utf8");
  return tasksDir;
}

describe("finish command", () => {
  it("transitions in-progress feature to done when all tasks are done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-finish-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const tasksDir = await scaffoldInProgressFeature(projectRoot);
    await writeFile(
      join(tasksDir, "setup-db.md"),
      "---\nid: TASK-001\nslug: setup-db\nstatus: done\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
      "utf8",
    );

    await buildProgram().parseAsync(["node", "scifi", "finish", "user-auth"]);

    const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    const metadata = JSON.parse(await readFile(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
    expect(metadata.status).toBe("done");
  });

  it("fails when a task is not done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-finish-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const tasksDir = await scaffoldInProgressFeature(projectRoot);
    await writeFile(
      join(tasksDir, "setup-db.md"),
      "---\nid: TASK-001\nslug: setup-db\nstatus: in-progress\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
      "utf8",
    );

    await expect(
      buildProgram().parseAsync(["node", "scifi", "finish", "user-auth"]),
    ).rejects.toThrow("not all tasks are complete");
  });
});
```

Add to `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("finish");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/finish.test.ts tests/cli/index.test.ts
```

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/finish.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFinishCommand(program: Command): void {
  program
    .command("finish")
    .description("Mark a feature as done (requires all tasks to be done)")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      await updateFeatureStatus(cwd(), slug, "done", createTimestamp());
      process.stdout.write(`feature ${slug} marked as done\n`);
    });
}
```

- [ ] **Step 4: Register in index.ts**

```ts
import { registerFinishCommand } from "./commands/finish.js";
// inside buildProgram():
registerFinishCommand(program);
```

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npm test -- tests/cli/finish.test.ts tests/cli/index.test.ts
npm run typecheck
git add src/cli/commands/finish.ts src/cli/index.ts tests/cli/finish.test.ts tests/cli/index.test.ts
git commit -m "feat: add finish command"
```

---

## Task 13: list command

**Files:**
- Create: `src/cli/commands/list.ts`
- Create: `tests/cli/list.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/list.test.ts`:

```ts
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
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, "docs", "scifi", "specs");
    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await mkdir(join(specsDir, "payment-flow"), { recursive: true });
    await writeFile(
      join(specsDir, "user-auth", ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", title: "User Auth", status: "created", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(
      join(specsDir, "payment-flow", ".scifi.json"),
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
      await buildProgram().parseAsync(["node", "scifi", "list"]);
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
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-list-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const specsDir = join(projectRoot, "docs", "scifi", "specs");
    await mkdir(join(specsDir, "user-auth"), { recursive: true });
    await mkdir(join(specsDir, "payment-flow"), { recursive: true });
    await writeFile(
      join(specsDir, "user-auth", ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", status: "created", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(
      join(specsDir, "payment-flow", ".scifi.json"),
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
      await buildProgram().parseAsync(["node", "scifi", "list", "--status", "spec-ready"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).not.toContain("user-auth");
    expect(combined).toContain("payment-flow");
  });
});
```

Add to `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("list");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/list.test.ts tests/cli/index.test.ts
```

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/list.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { listFeatures } from "../../core/specs/list.js";
import type { FeatureStatus } from "../../core/specs/types.js";
import { FEATURE_STATUS_VALUES } from "../../core/specs/types.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List all features")
    .option("--status <status>", "filter by lifecycle status")
    .action(async (options: { status?: string }) => {
      const statusFilter =
        options.status !== undefined &&
        (FEATURE_STATUS_VALUES as readonly string[]).includes(options.status)
          ? (options.status as FeatureStatus)
          : undefined;

      const features = await listFeatures({ projectRoot: cwd(), status: statusFilter });

      for (const feature of features) {
        const title = feature.title ?? "";
        process.stdout.write(`${feature.id}\t${feature.slug}\t${feature.status}\t${title}\n`);
      }
    });
}
```

- [ ] **Step 4: Register in index.ts**

```ts
import { registerListCommand } from "./commands/list.js";
// inside buildProgram():
registerListCommand(program);
```

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npm test -- tests/cli/list.test.ts tests/cli/index.test.ts
npm run typecheck
git add src/cli/commands/list.ts src/cli/index.ts tests/cli/list.test.ts tests/cli/index.test.ts
git commit -m "feat: add list command"
```

---

## Task 14: status command

**Files:**
- Create: `src/cli/commands/status.ts`
- Create: `tests/cli/status.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/status.test.ts`:

```ts
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

describe("status command", () => {
  it("prints lifecycle snapshot for a feature", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-status-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, "docs", "scifi", "specs", "user-auth");
    const tasksDir = join(featureDir, "tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(featureDir, ".scifi.json"),
      JSON.stringify({ version: 1, id: "FEAT-0001", slug: "user-auth", title: "User Auth", status: "in-progress", createdAt: "2026-05-20T00:00:00Z", updatedAt: "2026-05-20T00:00:00Z" }, null, 2) + "\n",
      "utf8",
    );
    await writeFile(join(featureDir, "spec.md"), "# Spec\n", "utf8");
    await writeFile(join(featureDir, "architecture.md"), "# Architecture\n", "utf8");
    await writeFile(
      join(tasksDir, "setup-db.md"),
      "---\nid: TASK-001\nslug: setup-db\nstatus: done\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
      "utf8",
    );

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync(["node", "scifi", "status", "user-auth"]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("user-auth");
    expect(combined).toContain("in-progress");
    expect(combined).toContain("spec.md");
    expect(combined).toContain("architecture.md");
    expect(combined).toContain("setup-db");
    expect(combined).toContain("done");
  });
});
```

Add to `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("status");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/status.test.ts tests/cli/index.test.ts
```

- [ ] **Step 3: Implement the command**

Create `src/cli/commands/status.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { inspectFeatureLifecycle } from "../../core/specs/lifecycle.js";
import { listTasks } from "../../core/tasks/list.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show lifecycle status and artifact inventory for a feature")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      const projectRoot = cwd();
      const lifecycle = await inspectFeatureLifecycle(projectRoot, slug);
      const tasks = await listTasks(projectRoot, slug);

      const { metadata, artifacts } = lifecycle;
      const title = metadata.title !== undefined ? ` (${metadata.title})` : "";

      process.stdout.write(`slug:    ${metadata.slug}${title}\n`);
      process.stdout.write(`id:      ${metadata.id}\n`);
      process.stdout.write(`status:  ${metadata.status}\n`);
      process.stdout.write(`\n`);
      process.stdout.write(`spec.md:          ${artifacts.specExists ? "present" : "missing"}\n`);
      process.stdout.write(`architecture.md:  ${artifacts.architectureExists ? "present" : "missing"}\n`);
      process.stdout.write(`tasks:            ${artifacts.taskFileCount} file${artifacts.taskFileCount === 1 ? "" : "s"}\n`);

      if (tasks.length > 0) {
        process.stdout.write(`\n`);
        for (const task of tasks) {
          process.stdout.write(`  ${task.slug}\t${task.status}\n`);
        }
      }
    });
}
```

- [ ] **Step 4: Register in index.ts**

```ts
import { registerStatusCommand } from "./commands/status.js";
// inside buildProgram():
registerStatusCommand(program);
```

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npm test -- tests/cli/status.test.ts tests/cli/index.test.ts
npm run typecheck
git add src/cli/commands/status.ts src/cli/index.ts tests/cli/status.test.ts tests/cli/index.test.ts
git commit -m "feat: add status command"
```

---

## Task 15: task command group

**Files:**
- Create: `src/cli/commands/task.ts`
- Create: `tests/cli/task.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `tests/cli/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/cli/task.test.ts`:

```ts
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
  const tasksDir = join(projectRoot, "docs", "scifi", "specs", featureSlug, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskSlug}.md`),
    `---\nid: TASK-001\nslug: ${taskSlug}\nstatus: ${status}\nparallel: false\ndepends-on: []\n---\n# ${taskSlug}\n`,
    "utf8",
  );
}

describe("task list", () => {
  it("prints all tasks for a feature", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-cmd-"));
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
      await buildProgram().parseAsync(["node", "scifi", "task", "list", "user-auth"]);
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
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");

    await buildProgram().parseAsync(["node", "scifi", "task", "start", "user-auth", "setup-database"]);

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe("in-progress");
  });
});

describe("task done", () => {
  it("marks an in-progress task as done", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "in-progress");

    await buildProgram().parseAsync(["node", "scifi", "task", "done", "user-auth", "setup-database"]);

    const filePath = buildTaskFilePath(projectRoot, "user-auth", "setup-database");
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe("done");
  });

  it("fails when task is not in-progress", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-task-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await createTaskFile(projectRoot, "user-auth", "setup-database", "pending");

    await expect(
      buildProgram().parseAsync(["node", "scifi", "task", "done", "user-auth", "setup-database"]),
    ).rejects.toThrow("task is not in-progress");
  });
});
```

Add to `tests/cli/index.test.ts`:

```ts
expect(commandNames).toContain("task");
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/cli/task.test.ts tests/cli/index.test.ts
```

- [ ] **Step 3: Implement the command group**

Create `src/cli/commands/task.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { listTasks } from "../../core/tasks/list.js";
import { updateTaskStatus } from "../../core/tasks/transition.js";

export function registerTaskCommand(program: Command): void {
  const task = program
    .command("task")
    .description("Manage tasks within a feature");

  task
    .command("list")
    .description("List all tasks for a feature with their status")
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      const tasks = await listTasks(cwd(), slug);
      for (const t of tasks) {
        process.stdout.write(`${t.slug}\t${t.status}\tparallel=${String(t.parallel)}\n`);
      }
    });

  task
    .command("start")
    .description("Mark a task as in-progress")
    .argument("<slug>", "feature folder slug")
    .argument("<task>", "task slug")
    .action(async (slug: string, taskSlug: string) => {
      await updateTaskStatus(cwd(), slug, taskSlug, "in-progress");
      process.stdout.write(`task ${taskSlug} marked as in-progress\n`);
    });

  task
    .command("done")
    .description("Mark a task as done (requires task to be in-progress)")
    .argument("<slug>", "feature folder slug")
    .argument("<task>", "task slug")
    .action(async (slug: string, taskSlug: string) => {
      await updateTaskStatus(cwd(), slug, taskSlug, "done");
      process.stdout.write(`task ${taskSlug} marked as done\n`);
    });
}
```

- [ ] **Step 4: Register in index.ts**

```ts
import { registerTaskCommand } from "./commands/task.js";
// inside buildProgram():
registerTaskCommand(program);
```

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npm test -- tests/cli/task.test.ts tests/cli/index.test.ts
npm run typecheck
git add src/cli/commands/task.ts src/cli/index.ts tests/cli/task.test.ts tests/cli/index.test.ts
git commit -m "feat: add task command group (list, start, done)"
```

---

## Task 16: E2E installed lifecycle test

**Files:**
- Create: `tests/e2e/installed-lifecycle.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/installed-lifecycle.test.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledCommand,
} from "./installed-test-helpers.js";

describe("installed build lifecycle verification", () => {
  it("drives a feature from created through done via installed binary", () => {
    const installation = createInstalledPackageTestEnvironment("installed-lifecycle-");

    try {
      const dir = installation.installDirectory;

      // Create feature
      let result = runInstalledCommand(dir, ["spec", "user-auth", "--title", "User Auth"]);
      expect(result.status).toBe(0);

      const featureDir = join(dir, "docs", "scifi", "specs", "user-auth");
      expect(existsSync(join(featureDir, ".scifi.json"))).toBe(true);

      // Write spec.md then mark spec-ready
      writeFileSync(join(featureDir, "spec.md"), "# User Auth Spec\n", "utf8");
      result = runInstalledCommand(dir, ["spec-ready", "user-auth"]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      let metadata = JSON.parse(readFileSync(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
      expect(metadata.status).toBe("spec-ready");

      // Write architecture.md and a task, then mark plan-ready
      writeFileSync(join(featureDir, "architecture.md"), "# Architecture\n", "utf8");
      const tasksDir = join(featureDir, "tasks");
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(
        join(tasksDir, "setup-db.md"),
        "---\nid: TASK-001\nslug: setup-db\nstatus: pending\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
        "utf8",
      );

      result = runInstalledCommand(dir, ["plan-ready", "user-auth"]);
      expect(result.status).toBe(0);
      metadata = JSON.parse(readFileSync(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
      expect(metadata.status).toBe("plan-ready");

      // Start implementation
      result = runInstalledCommand(dir, ["start", "user-auth"]);
      expect(result.status).toBe(0);
      metadata = JSON.parse(readFileSync(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
      expect(metadata.status).toBe("in-progress");

      // Start and complete the task
      result = runInstalledCommand(dir, ["task", "start", "user-auth", "setup-db"]);
      expect(result.status).toBe(0);

      result = runInstalledCommand(dir, ["task", "done", "user-auth", "setup-db"]);
      expect(result.status).toBe(0);

      // Finish the feature
      result = runInstalledCommand(dir, ["finish", "user-auth"]);
      expect(result.status).toBe(0);
      metadata = JSON.parse(readFileSync(join(featureDir, ".scifi.json"), "utf8")) as { status: string };
      expect(metadata.status).toBe("done");
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it("fails spec-ready when spec.md is missing from installed binary", () => {
    const installation = createInstalledPackageTestEnvironment("installed-lifecycle-err-");

    try {
      const dir = installation.installDirectory;

      runInstalledCommand(dir, ["spec", "user-auth"]);

      const result = runInstalledCommand(dir, ["spec-ready", "user-auth"]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("spec.md is missing");
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
});
```

- [ ] **Step 2: Run the E2E test**

```bash
npm test -- tests/e2e/installed-lifecycle.test.ts
```

Expected: PASS (this builds, packs, installs, and runs the full lifecycle through the real binary)

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 4: Typecheck one final time**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/installed-lifecycle.test.ts
git commit -m "test: add installed lifecycle e2e verification"
```
