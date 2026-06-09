# Spec Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first `scifi` feature lifecycle primitive by implementing `scifi spec <slug> [--title]`, feature metadata under `docs/scifi/specs/<slug>/.scifi.json`, and reusable lifecycle validation helpers for later slash-command workflows.

**Architecture:** This stays aligned with the existing repository boundaries: CLI registration and output live in `src/cli`, feature lifecycle logic lives in a new focused `src/core/specs/` area, and verification covers pure core logic, source CLI behavior, and installed-build command behavior. Public CLI scope remains intentionally narrow for this milestone: only `scifi spec` is exposed, while status transition helpers are implemented in core for future commands to consume.

**Tech Stack:** Node.js, TypeScript, Commander, Vitest, npm

---

### Task 1: Add the Spec Lifecycle Domain Model

**Files:**
- Create: `src/core/specs/types.ts`
- Create: `src/core/specs/paths.ts`
- Create: `src/core/specs/metadata.ts`
- Test: `tests/core/specs/metadata.test.ts`

- [ ] **Step 1: Write the failing metadata and path tests**

Create `tests/core/specs/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  buildFeatureDirectoryPath,
  buildFeatureMetadataPath,
  createInitialFeatureMetadata,
} from "../../../src/core/specs/metadata.js";

describe("createInitialFeatureMetadata", () => {
  it("creates the initial metadata shape for a new feature", () => {
    const metadata = createInitialFeatureMetadata({
      id: "FEAT-0001",
      slug: "user-auth",
      title: "User Auth",
      createdAt: "2026-05-20T06:29:55Z",
    });

    expect(metadata).toEqual({
      version: 1,
      id: "FEAT-0001",
      slug: "user-auth",
      title: "User Auth",
      status: "created",
      createdAt: "2026-05-20T06:29:55Z",
      updatedAt: "2026-05-20T06:29:55Z",
    });
  });
});

describe("feature path helpers", () => {
  it("places scifi-managed features under docs/scifi/specs", () => {
    const projectRoot = "/repo";

    expect(buildFeatureDirectoryPath(projectRoot, "user-auth")).toBe(
      join(projectRoot, "docs", "scifi", "specs", "user-auth"),
    );
    expect(buildFeatureMetadataPath(projectRoot, "user-auth")).toBe(
      join(projectRoot, "docs", "scifi", "specs", "user-auth", ".scifi.json"),
    );
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/core/specs/metadata.test.ts`
Expected: FAIL because `src/core/specs/metadata.ts` does not exist.

- [ ] **Step 3: Add focused types for metadata and lifecycle state**

Create `src/core/specs/types.ts`:

```ts
export const FEATURE_STATUS_VALUES = [
  "created",
  "spec-ready",
  "plan-ready",
  "in-progress",
  "done",
] as const;

export type FeatureStatus = (typeof FEATURE_STATUS_VALUES)[number];

export interface FeatureMetadata {
  version: 1;
  id: string;
  slug: string;
  title?: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureMetadataInput {
  id: string;
  slug: string;
  title?: string;
  createdAt: string;
}
```

- [ ] **Step 4: Add path helpers for the namespaced feature location**

Create `src/core/specs/paths.ts`:

```ts
import { join } from "node:path";

export function buildFeaturesRootPath(projectRoot: string): string {
  return join(projectRoot, "docs", "scifi", "specs");
}

export function buildFeatureDirectoryPath(
  projectRoot: string,
  slug: string,
): string {
  return join(buildFeaturesRootPath(projectRoot), slug);
}

export function buildFeatureMetadataPath(
  projectRoot: string,
  slug: string,
): string {
  return join(buildFeatureDirectoryPath(projectRoot, slug), ".scifi.json");
}
```

- [ ] **Step 5: Add metadata construction helpers**

Create `src/core/specs/metadata.ts`:

```ts
import type { CreateFeatureMetadataInput, FeatureMetadata } from "./types.js";
export {
  buildFeatureDirectoryPath,
  buildFeatureMetadataPath,
} from "./paths.js";

export function createInitialFeatureMetadata(
  input: CreateFeatureMetadataInput,
): FeatureMetadata {
  const { id, slug, title, createdAt } = input;

  return {
    version: 1,
    id,
    slug,
    title,
    status: "created",
    createdAt,
    updatedAt: createdAt,
  };
}
```

- [ ] **Step 6: Run the targeted test, then typecheck**

Run: `npm test -- --run tests/core/specs/metadata.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/specs/types.ts src/core/specs/paths.ts src/core/specs/metadata.ts tests/core/specs/metadata.test.ts
git commit -m "feat: add spec lifecycle metadata model"
```

### Task 2: Implement Feature Creation Core Logic

**Files:**
- Create: `src/core/specs/create.ts`
- Create: `src/core/specs/id.ts`
- Test: `tests/core/specs/create.test.ts`

- [ ] **Step 1: Write the failing feature creation tests**

Create `tests/core/specs/create.test.ts`:

```ts
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFeature } from "../../../src/core/specs/create.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map(async (directory) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(directory, { recursive: true, force: true }),
      );
    }),
  );
  temporaryDirectories.length = 0;
});

describe("createFeature", () => {
  it("creates a feature folder with only .scifi.json", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-create-"));
    temporaryDirectories.push(projectRoot);

    const result = await createFeature({
      projectRoot,
      slug: "user-auth",
      title: "User Auth",
      now: "2026-05-20T06:29:55Z",
    });

    expect(result.featureDirectoryPath).toBe(
      join(projectRoot, "docs", "scifi", "specs", "user-auth"),
    );
    expect(result.metadataPath).toBe(
      join(projectRoot, "docs", "scifi", "specs", "user-auth", ".scifi.json"),
    );

    const metadataContents = JSON.parse(
      await readFile(result.metadataPath, "utf8"),
    );

    expect(metadataContents.status).toBe("created");
    await expect(stat(join(result.featureDirectoryPath, "spec.md"))).rejects.toThrow();
    await expect(stat(join(result.featureDirectoryPath, "architecture.md"))).rejects.toThrow();
    await expect(stat(join(result.featureDirectoryPath, "tasks"))).rejects.toThrow();
  });

  it("fails when the feature directory already exists", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-create-"));
    temporaryDirectories.push(projectRoot);

    await createFeature({
      projectRoot,
      slug: "user-auth",
      now: "2026-05-20T06:29:55Z",
    });

    await expect(
      createFeature({
        projectRoot,
        slug: "user-auth",
        now: "2026-05-20T06:30:55Z",
      }),
    ).rejects.toThrow(
      `Cannot create feature user-auth: ${join(projectRoot, "docs", "scifi", "specs", "user-auth")} already exists.`,
    );
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/core/specs/create.test.ts`
Expected: FAIL because `src/core/specs/create.ts` does not exist.

- [ ] **Step 3: Add a focused ID generator for feature metadata**

Create `src/core/specs/id.ts`:

```ts
export function formatFeatureId(sequenceNumber: number): string {
  return `FEAT-${sequenceNumber.toString().padStart(4, "0")}`;
}
```

- [ ] **Step 4: Add the feature creation core module**

Create `src/core/specs/create.ts`:

```ts
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { buildFeaturesRootPath, buildFeatureDirectoryPath, buildFeatureMetadataPath } from "./paths.js";
import { createInitialFeatureMetadata } from "./metadata.js";
import { formatFeatureId } from "./id.js";

export interface CreateFeatureOptions {
  projectRoot: string;
  slug: string;
  title?: string;
  now: string;
}

export interface CreateFeatureResult {
  id: string;
  featureDirectoryPath: string;
  metadataPath: string;
}

export async function createFeature(
  options: CreateFeatureOptions,
): Promise<CreateFeatureResult> {
  const { projectRoot, slug, title, now } = options;
  const featuresRootPath = buildFeaturesRootPath(projectRoot);
  const featureDirectoryPath = buildFeatureDirectoryPath(projectRoot, slug);
  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);

  const existingFeatureDirectory = await stat(featureDirectoryPath).catch(() => null);

  if (existingFeatureDirectory !== null) {
    throw new Error(
      `Cannot create feature ${slug}: ${featureDirectoryPath} already exists.`,
    );
  }

  await mkdir(featuresRootPath, { recursive: true });

  const existingEntries = await readdir(featuresRootPath, {
    withFileTypes: true,
  }).catch(() => []);
  const nextId = formatFeatureId(existingEntries.filter((entry) => entry.isDirectory()).length + 1);

  await mkdir(featureDirectoryPath, { recursive: false });

  const metadata = createInitialFeatureMetadata({
    id: nextId,
    slug,
    title,
    createdAt: now,
  });

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");

  return {
    id: nextId,
    featureDirectoryPath,
    metadataPath,
  };
}
```

- [ ] **Step 5: Run the targeted test, then the core spec suite**

Run: `npm test -- --run tests/core/specs/create.test.ts`
Expected: PASS

Run: `npm test -- --run tests/core/specs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/specs/create.ts src/core/specs/id.ts tests/core/specs/create.test.ts
git commit -m "feat: add feature creation core logic"
```

### Task 3: Wire the `scifi spec` CLI Command

**Files:**
- Create: `src/cli/commands/spec.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/cli/spec.test.ts`
- Test: `tests/cli/index.test.ts`

- [ ] **Step 1: Write the failing CLI tests for the new command**

Create `tests/cli/spec.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../../src/cli/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

describe("spec command", () => {
  it("creates a feature container in the current repository", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-cli-spec-"));
    temporaryDirectories.push(projectRoot);
    vi.spyOn(process, "cwd").mockReturnValue(projectRoot);

    const program = buildProgram();

    await program.parseAsync(["node", "scifi", "spec", "user-auth", "--title", "User Auth"]);

    const metadata = JSON.parse(
      await readFile(
        join(projectRoot, "docs", "scifi", "specs", "user-auth", ".scifi.json"),
        "utf8",
      ),
    );

    expect(metadata.slug).toBe("user-auth");
    expect(metadata.title).toBe("User Auth");
    expect(metadata.status).toBe("created");
  });
});
```

Update `tests/cli/index.test.ts` expectation:

```ts
expect(commandNames).toEqual(expect.arrayContaining(["init", "spec"]));
```

- [ ] **Step 2: Run the targeted CLI tests to confirm failure**

Run: `npm test -- --run tests/cli/index.test.ts tests/cli/spec.test.ts`
Expected: FAIL because `src/cli/commands/spec.ts` does not exist and the command is not registered.

- [ ] **Step 3: Implement the new command module**

Create `src/cli/commands/spec.ts`:

```ts
import { Command } from "commander";
import { cwd } from "node:process";
import { createFeature } from "../../core/specs/create.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerSpecCommand(program: Command): void {
  program
    .command("spec")
    .description("Create a scifi-managed feature container")
    .argument("<slug>", "feature folder slug")
    .option("--title <title>", "display title for the feature")
    .action(async (slug: string, options: { title?: string }) => {
      await createFeature({
        projectRoot: cwd(),
        slug,
        title: options.title,
        now: createTimestamp(),
      });
    });
}
```

- [ ] **Step 4: Register the command in the CLI entrypoint**

Update `src/cli/index.ts`:

```ts
import { registerSpecCommand } from "./commands/spec.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("scifi")
    .description("Specification-driven CLI scaffolding for agentic workflows")
    .version(readPackageVersion(packageJson));

  registerInitCommand(program);
  registerSpecCommand(program);

  return program;
}
```

- [ ] **Step 5: Run the targeted CLI tests, then typecheck and build**

Run: `npm test -- --run tests/cli/index.test.ts tests/cli/spec.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/spec.ts src/cli/index.ts tests/cli/spec.test.ts tests/cli/index.test.ts
git commit -m "feat: add spec command"
```

### Task 4: Add Reusable Lifecycle Inspection and Transition Validation

**Files:**
- Create: `src/core/specs/lifecycle.ts`
- Test: `tests/core/specs/lifecycle.test.ts`

- [ ] **Step 1: Write the failing lifecycle tests**

Create `tests/core/specs/lifecycle.test.ts`:

```ts
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
    const projectRoot = await mkdtemp(join(tmpdir(), "scifi-lifecycle-"));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, "docs", "scifi", "specs", "user-auth");

    await mkdir(featureRoot, { recursive: true });
    await writeFile(
      join(featureRoot, ".scifi.json"),
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
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/core/specs/lifecycle.test.ts`
Expected: FAIL because `src/core/specs/lifecycle.ts` does not exist.

- [ ] **Step 3: Implement lifecycle inspection and strict transition guards**

Create `src/core/specs/lifecycle.ts`:

```ts
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildFeatureDirectoryPath, buildFeatureMetadataPath } from "./paths.js";
import type { FeatureMetadata, FeatureStatus } from "./types.js";

export interface FeatureArtifacts {
  specExists: boolean;
  architectureExists: boolean;
  taskFileCount: number;
}

export interface FeatureLifecycle {
  metadata: FeatureMetadata;
  artifacts: FeatureArtifacts;
}

export async function inspectFeatureLifecycle(
  projectRoot: string,
  slug: string,
): Promise<FeatureLifecycle> {
  const featureRoot = buildFeatureDirectoryPath(projectRoot, slug);
  const metadataPath = buildFeatureMetadataPath(projectRoot, slug);
  const metadata = JSON.parse(
    await readFile(metadataPath, "utf8"),
  ) as FeatureMetadata;

  const specExists = await pathIsRegularFile(join(featureRoot, "spec.md"));
  const architectureExists = await pathIsRegularFile(
    join(featureRoot, "architecture.md"),
  );
  const taskEntries = await readdir(join(featureRoot, "tasks"), {
    withFileTypes: true,
  }).catch(() => []);
  const taskFileCount = taskEntries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".md"),
  ).length;

  return {
    metadata,
    artifacts: {
      specExists,
      architectureExists,
      taskFileCount,
    },
  };
}

export async function validateStatusTransition(
  artifacts: FeatureArtifacts,
  targetStatus: FeatureStatus,
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
}

async function pathIsRegularFile(filePath: string): Promise<boolean> {
  const entry = await stat(filePath).catch(() => null);
  return entry?.isFile() ?? false;
}
```

- [ ] **Step 4: Run the targeted test and the full core suite**

Run: `npm test -- --run tests/core/specs/lifecycle.test.ts`
Expected: PASS

Run: `npm test -- --run tests/core/specs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/specs/lifecycle.ts tests/core/specs/lifecycle.test.ts
git commit -m "feat: add lifecycle validation helpers"
```

### Task 5: Update Documentation and Installed-Build Verification

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `src/core/init/scaffold.ts`
- Create: `tests/e2e/installed-test-helpers.ts`
- Test: `tests/e2e/installed-spec.test.ts`

- [ ] **Step 1: Write the failing installed-build verification for `scifi spec`**

Create `tests/e2e/installed-spec.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createInstalledPackageTestEnvironment,
  cleanupInstalledPackageTestEnvironment,
  runInstalledCommand,
} from "./installed-test-helpers.js";

describe("installed build spec verification", () => {
  it("creates a feature container in docs/scifi/specs from an installed package", () => {
    const installation = createInstalledPackageTestEnvironment();

    try {
      const result = runInstalledCommand(installation.installDirectory, [
        "spec",
        "user-auth",
        "--title",
        "User Auth",
      ]);

      expect(result.status).toBe(0);
      expect(
        existsSync(
          join(
            installation.installDirectory,
            "docs",
            "scifi",
            "specs",
            "user-auth",
            ".scifi.json",
          ),
        ),
      ).toBe(true);

      const metadata = JSON.parse(
        readFileSync(
          join(
            installation.installDirectory,
            "docs",
            "scifi",
            "specs",
            "user-auth",
            ".scifi.json",
          ),
          "utf8",
        ),
      );

      expect(metadata.slug).toBe("user-auth");
      expect(metadata.status).toBe("created");
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
});
```

The initial failure is expected because `tests/e2e/installed-test-helpers.ts` does not yet exist and the installed-build helpers are still embedded inside `tests/e2e/installed-init.test.ts`.

- [ ] **Step 2: Run the targeted installed-build test to confirm failure**

Run: `npm test -- --run tests/e2e/installed-spec.test.ts`
Expected: FAIL because the shared installed-build helpers do not exist yet.

- [ ] **Step 3: Extract reusable installed-build helpers and add the new verification**

Create `tests/e2e/installed-test-helpers.ts` with shared packaging, sandbox, and command-running helpers:

```ts
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export interface InstalledCommandResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

export function runInstalledCommand(
  installDirectory: string,
  args: readonly string[],
): InstalledCommandResult {
  const result = spawnSync(
    join(installDirectory, "node_modules", ".bin", "scifi"),
    args,
    {
      cwd: installDirectory,
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}
```

Move the existing helper setup from `tests/e2e/installed-init.test.ts` into the shared helper file, update `installed-init.test.ts` to import those helpers, and add `installed-spec.test.ts` as the second installed-build command check.

- [ ] **Step 4: Update repository docs and bootstrap guidance**

Update `README.md` command surface and generated structure guidance:

Suggested README content:

```text
## Current Command Surface

scifi init
scifi spec <slug> [--title "..."]

`scifi spec` creates a feature container under `docs/scifi/specs/<slug>/`
and writes `.scifi.json` with the CLI-managed feature identifier and status.
```

Update `ROADMAP.md` Spec Lifecycle item so it no longer promises `plan.md` or initial template scaffolding:

```md
2. Spec Lifecycle
   `scifi spec`, namespaced feature folders, CLI-managed feature metadata,
   slug-based feature identity, and lifecycle validation helpers.
```

Update `src/core/init/scaffold.ts` generated `AGENTS.md` text so bootstrap guidance no longer points contributors at repo-root `specs/`:

```ts
- Capture scifi-managed feature work in `docs/scifi/specs/` before implementing.
```

- [ ] **Step 5: Run the full required verification set**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npm test`
Expected: PASS

Run: `npm run coverage`
Expected: PASS

Run: `npm test -- --run tests/e2e/installed-init.test.ts tests/e2e/installed-spec.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md ROADMAP.md src/core/init/scaffold.ts tests/e2e/installed-test-helpers.ts tests/e2e/installed-init.test.ts tests/e2e/installed-spec.test.ts
git commit -m "test: add installed spec lifecycle verification"
```

## Self-Review

### Spec coverage

- Feature path under `docs/scifi/specs/<slug>/`: covered by Tasks 1, 2, 3, and 5.
- CLI-owned `.scifi.json`: covered by Tasks 1 and 2.
- `scifi spec <slug> [--title]`: covered by Task 3 and Task 5.
- No eager creation of `spec.md`, `architecture.md`, or `tasks/`: covered by Task 2 tests.
- Lifecycle states and strict transition rules: covered by Task 4.
- Installed-build verification for user-facing CLI behavior: covered by Task 5.
- Roadmap and docs alignment with the revised lifecycle model: covered by Task 5.

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders remain in the plan. Commands, file paths, and test expectations are explicit.

### Type consistency

- The plan uses one metadata model throughout: `FeatureMetadata`.
- The only public CLI addition in this plan is `scifi spec`.
- Lifecycle statuses are consistent across tasks: `created`, `spec-ready`, `plan-ready`, `in-progress`, `done`.
