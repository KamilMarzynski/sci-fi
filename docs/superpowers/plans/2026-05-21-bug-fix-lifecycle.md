# Bug & Fix Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `specflow bug` and `specflow fix` CLI commands, enforce open-fix blocking in `specflow finish`, and surface fix counts in `specflow list` and `specflow status`.

**Architecture:** Two separate core modules (`src/core/bugs/`, `src/core/fixes/`) share no code but follow identical patterns (types → paths → id → frontmatter → create). `finish` pre-checks `listOpenFixes` before calling `updateFeatureStatus`. `list` and `status` call `listFixes` per feature.

**Tech Stack:** TypeScript, Node.js `fs/promises`, `yaml` package (already installed), `commander` (already installed), `vitest` for tests.

---

## File Map

**New files:**
- `src/core/bugs/types.ts` — `BugStatus`, `BugSeverity`, `BugFrontmatter`
- `src/core/bugs/paths.ts` — `buildBugsRootPath`, `buildBugFilePath`
- `src/core/bugs/id.ts` — `formatBugId`
- `src/core/bugs/frontmatter.ts` — `readBugFile`, `writeBugFile`
- `src/core/bugs/create.ts` — `createBug`
- `src/core/fixes/types.ts` — `FixStatus`, `FixFrontmatter`
- `src/core/fixes/paths.ts` — `buildFixesDirectoryPath`, `buildFixFilePath`
- `src/core/fixes/id.ts` — `formatFixId`
- `src/core/fixes/frontmatter.ts` — `readFixFile`, `writeFixFile`
- `src/core/fixes/create.ts` — `createFix`
- `src/core/fixes/list.ts` — `listFixes`, `listOpenFixes`
- `src/cli/commands/bug.ts` — `registerBugCommand`
- `src/cli/commands/fix.ts` — `registerFixCommand`
- `tests/core/bugs/create.test.ts`
- `tests/core/fixes/create.test.ts`
- `tests/core/fixes/list.test.ts`

**Modified files:**
- `src/cli/index.ts` — register bug and fix commands
- `src/cli/commands/finish.ts` — pre-check open fixes
- `src/cli/commands/list.ts` — show open fix count per feature
- `src/cli/commands/status.ts` — show fixes block
- `tests/cli/finish.test.ts` — new fix-blocking test cases
- `tests/cli/list.test.ts` — fix count column test cases
- `tests/cli/status.test.ts` — fixes block test cases

---

## Task 1: Bug types, paths, and ID

**Files:**
- Create: `src/core/bugs/types.ts`
- Create: `src/core/bugs/paths.ts`
- Create: `src/core/bugs/id.ts`
- Create: `tests/core/bugs/id.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/bugs/id.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatBugId } from "../../../src/core/bugs/id.js";

describe("formatBugId", () => {
  it("pads single digits to four places", () => {
    expect(formatBugId(1)).toBe("BUG-0001");
  });

  it("pads two digit numbers", () => {
    expect(formatBugId(42)).toBe("BUG-0042");
  });

  it("does not truncate large numbers", () => {
    expect(formatBugId(10000)).toBe("BUG-10000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/bugs/id.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create types, paths, and id files**

Create `src/core/bugs/types.ts`:

```typescript
export const BUG_STATUS_VALUES = [
  "open",
  "in-progress",
  "resolved",
  "wont-fix",
] as const;

export type BugStatus = (typeof BUG_STATUS_VALUES)[number];

export const BUG_SEVERITY_VALUES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type BugSeverity = (typeof BUG_SEVERITY_VALUES)[number];

export interface BugFrontmatter {
  id: string;
  slug: string;
  status: BugStatus;
  severity?: BugSeverity;
  "related-feature"?: string;
  created: string;
}
```

Create `src/core/bugs/paths.ts`:

```typescript
import { join } from "node:path";

export function buildBugsRootPath(projectRoot: string): string {
  return join(projectRoot, "bugs");
}

export function buildBugFilePath(
  projectRoot: string,
  id: string,
  slug: string,
): string {
  return join(buildBugsRootPath(projectRoot), `${id}-${slug}.md`);
}
```

Create `src/core/bugs/id.ts`:

```typescript
export function formatBugId(sequenceNumber: number): string {
  return `BUG-${sequenceNumber.toString().padStart(4, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/bugs/id.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/bugs/types.ts src/core/bugs/paths.ts src/core/bugs/id.ts tests/core/bugs/id.test.ts
git commit -m "feat: add bug types, paths, and id formatter"
```

---

## Task 2: Bug frontmatter reader/writer

**Files:**
- Create: `src/core/bugs/frontmatter.ts`
- Create: `tests/core/bugs/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/bugs/frontmatter.test.ts`:

```typescript
import { mkdtemp, rm } from "node:fs/promises";
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
    expect(result.frontmatter.severity).toBeUndefined();
    expect(result.frontmatter["related-feature"]).toBeUndefined();
  });

  it("throws on missing frontmatter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-bug-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "bad.md");

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, "no frontmatter here\n", "utf8");

    await expect(readBugFile(filePath)).rejects.toThrow("missing YAML frontmatter");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/bugs/frontmatter.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement frontmatter reader/writer**

Create `src/core/bugs/frontmatter.ts`:

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  BUG_SEVERITY_VALUES,
  BUG_STATUS_VALUES,
  type BugFrontmatter,
} from "./types.js";

export interface BugFile {
  frontmatter: BugFrontmatter;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function isValidBugStatus(value: unknown): value is BugFrontmatter["status"] {
  return (
    typeof value === "string" &&
    (BUG_STATUS_VALUES as readonly string[]).includes(value)
  );
}

function isValidBugSeverity(
  value: unknown,
): value is BugFrontmatter["severity"] {
  return (
    value === undefined ||
    (typeof value === "string" &&
      (BUG_SEVERITY_VALUES as readonly string[]).includes(value))
  );
}

function isValidRawBugFrontmatter(
  raw: unknown,
): raw is Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["slug"] === "string" &&
    isValidBugStatus(obj["status"]) &&
    isValidBugSeverity(obj["severity"]) &&
    typeof obj["created"] === "string"
  );
}

export async function readBugFile(filePath: string): Promise<BugFile> {
  const content = await readFile(filePath, "utf8");
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    throw new Error(`Bug file at ${filePath} is missing YAML frontmatter.`);
  }

  const raw = parseYaml(match[1] ?? "") as unknown;

  if (!isValidRawBugFrontmatter(raw)) {
    throw new Error(`Bug file at ${filePath} has invalid frontmatter.`);
  }

  return {
    frontmatter: {
      id: raw["id"] as string,
      slug: raw["slug"] as string,
      status: raw["status"] as BugFrontmatter["status"],
      ...(raw["severity"] !== undefined && {
        severity: raw["severity"] as BugFrontmatter["severity"],
      }),
      ...(raw["related-feature"] !== undefined && {
        "related-feature": raw["related-feature"] as string,
      }),
      created: raw["created"] as string,
    },
    body: match[2] ?? "",
  };
}

export async function writeBugFile(
  filePath: string,
  file: BugFile,
): Promise<void> {
  const rawFrontmatter: Record<string, unknown> = {
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    status: file.frontmatter.status,
    ...(file.frontmatter.severity !== undefined && {
      severity: file.frontmatter.severity,
    }),
    ...(file.frontmatter["related-feature"] !== undefined && {
      "related-feature": file.frontmatter["related-feature"],
    }),
    created: file.frontmatter.created,
  };

  const content = `---\n${stringifyYaml(rawFrontmatter)}---\n${file.body}`;
  await writeFile(filePath, content, "utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/bugs/frontmatter.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/bugs/frontmatter.ts tests/core/bugs/frontmatter.test.ts
git commit -m "feat: add bug frontmatter reader/writer"
```

---

## Task 3: Bug create function

**Files:**
- Create: `src/core/bugs/create.ts`
- Create: `tests/core/bugs/create.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/bugs/create.test.ts`:

```typescript
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBug } from "../../../src/core/bugs/create.js";
import { readBugFile } from "../../../src/core/bugs/frontmatter.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe("createBug", () => {
  it("creates bugs/ dir and writes a bug file", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-create-"));
    temporaryDirectories.push(projectRoot);

    const result = await createBug({
      projectRoot,
      description: "login crash on mobile",
      now: "2026-05-21T00:00:00.000Z",
    });

    expect(result.id).toBe("BUG-0001");
    expect(result.filePath).toBe(
      join(projectRoot, "bugs", "BUG-0001-login-crash-on-mobile.md"),
    );

    const file = await readBugFile(result.filePath);
    expect(file.frontmatter.id).toBe("BUG-0001");
    expect(file.frontmatter.slug).toBe("login-crash-on-mobile");
    expect(file.frontmatter.status).toBe("open");
    expect(file.frontmatter.severity).toBeUndefined();
    expect(file.frontmatter["related-feature"]).toBeUndefined();
    expect(file.body).toBe("# login crash on mobile\n");
  });

  it("creates a bug with optional severity and related-feature", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-create-"));
    temporaryDirectories.push(projectRoot);

    const result = await createBug({
      projectRoot,
      description: "null ref",
      severity: "critical",
      relatedFeature: "auth-flow",
      now: "2026-05-21T00:00:00.000Z",
    });

    const file = await readBugFile(result.filePath);
    expect(file.frontmatter.severity).toBe("critical");
    expect(file.frontmatter["related-feature"]).toBe("auth-flow");
  });

  it("assigns sequential IDs based on existing file count", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-create-"));
    temporaryDirectories.push(projectRoot);

    const first = await createBug({
      projectRoot,
      description: "first bug",
      now: "2026-05-21T00:00:00.000Z",
    });
    const second = await createBug({
      projectRoot,
      description: "second bug",
      now: "2026-05-21T00:00:00.000Z",
    });

    expect(first.id).toBe("BUG-0001");
    expect(second.id).toBe("BUG-0002");
  });

  it("creates bugs/ dir if it does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-create-"));
    temporaryDirectories.push(projectRoot);

    await createBug({
      projectRoot,
      description: "something broke",
      now: "2026-05-21T00:00:00.000Z",
    });

    const entries = await readdir(join(projectRoot, "bugs"));
    expect(entries).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/bugs/create.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement createBug**

Create `src/core/bugs/create.ts`:

```typescript
import { mkdir, readdir } from "node:fs/promises";
import { writeBugFile } from "./frontmatter.js";
import { formatBugId } from "./id.js";
import { buildBugFilePath, buildBugsRootPath } from "./paths.js";
import type { BugSeverity } from "./types.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CreateBugOptions {
  projectRoot: string;
  description: string;
  relatedFeature?: string;
  severity?: BugSeverity;
  now: string;
}

export interface CreateBugResult {
  id: string;
  filePath: string;
}

export async function createBug(
  options: CreateBugOptions,
): Promise<CreateBugResult> {
  const { projectRoot, description, relatedFeature, severity, now } = options;
  const bugsRoot = buildBugsRootPath(projectRoot);

  await mkdir(bugsRoot, { recursive: true });

  const existing = await readdir(bugsRoot, { withFileTypes: true });
  const mdCount = existing.filter(
    (e) => e.isFile() && e.name.endsWith(".md"),
  ).length;

  const id = formatBugId(mdCount + 1);
  const slug = slugify(description);
  const filePath = buildBugFilePath(projectRoot, id, slug);

  await writeBugFile(filePath, {
    frontmatter: {
      id,
      slug,
      status: "open",
      ...(severity !== undefined && { severity }),
      ...(relatedFeature !== undefined && { "related-feature": relatedFeature }),
      created: now,
    },
    body: `# ${description}\n`,
  });

  return { id, filePath };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/bugs/create.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/bugs/create.ts tests/core/bugs/create.test.ts
git commit -m "feat: add createBug core function"
```

---

## Task 4: `specflow bug` CLI command

**Files:**
- Create: `src/cli/commands/bug.ts`
- Modify: `src/cli/index.ts`
- Create: `tests/cli/bug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/bug.test.ts`:

```typescript
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";
import { readBugFile } from "../../src/core/bugs/frontmatter.js";

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe("bug command", () => {
  it("creates a standalone bug file and prints id and path", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync([
        "node",
        "specflow",
        "bug",
        "login crash on mobile",
      ]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("BUG-0001");
    expect(combined).toContain("login-crash-on-mobile");

    const bugPath = join(projectRoot, "bugs", "BUG-0001-login-crash-on-mobile.md");
    const file = await readBugFile(bugPath);
    expect(file.frontmatter.status).toBe("open");
  });

  it("creates a bug with severity and related-feature flags", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-bug-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await buildProgram().parseAsync([
      "node",
      "specflow",
      "bug",
      "null ref in checkout",
      "--severity",
      "high",
      "--related-feature",
      "payments",
    ]);

    const bugPath = join(projectRoot, "bugs", "BUG-0001-null-ref-in-checkout.md");
    const file = await readBugFile(bugPath);
    expect(file.frontmatter.severity).toBe("high");
    expect(file.frontmatter["related-feature"]).toBe("payments");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/cli/bug.test.ts
```

Expected: FAIL with "unknown command 'bug'"

- [ ] **Step 3: Implement the bug command and register it**

Create `src/cli/commands/bug.ts`:

```typescript
import { Command } from "commander";
import { cwd } from "node:process";
import { createBug } from "../../core/bugs/create.js";
import {
  BUG_SEVERITY_VALUES,
  type BugSeverity,
} from "../../core/bugs/types.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerBugCommand(program: Command): void {
  program
    .command("bug")
    .description("Create a standalone bug report in the root bugs/ directory")
    .argument("<description>", "short description of the bug")
    .option("--related-feature <slug>", "feature slug for context")
    .option(
      "--severity <level>",
      "severity level: low, medium, high, or critical",
    )
    .action(
      async (
        description: string,
        options: { relatedFeature?: string; severity?: string },
      ) => {
        const severity =
          options.severity !== undefined &&
          (BUG_SEVERITY_VALUES as readonly string[]).includes(options.severity)
            ? (options.severity as BugSeverity)
            : undefined;

        const result = await createBug({
          projectRoot: cwd(),
          description,
          ...(options.relatedFeature !== undefined && {
            relatedFeature: options.relatedFeature,
          }),
          ...(severity !== undefined && { severity }),
          now: createTimestamp(),
        });

        process.stdout.write(`${result.id}  ${result.filePath}\n`);
      },
    );
}
```

Add to `src/cli/index.ts` — insert after the existing imports and before `buildProgram`:

```typescript
import { registerBugCommand } from "./commands/bug.js";
```

And inside `buildProgram()`, after the last `register...` call:

```typescript
registerBugCommand(program);
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/cli/bug.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/bug.ts src/cli/index.ts tests/cli/bug.test.ts
git commit -m "feat: add specflow bug command"
```

---

## Task 5: Fix types, paths, and ID

**Files:**
- Create: `src/core/fixes/types.ts`
- Create: `src/core/fixes/paths.ts`
- Create: `src/core/fixes/id.ts`
- Create: `tests/core/fixes/id.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/fixes/id.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatFixId } from "../../../src/core/fixes/id.js";

describe("formatFixId", () => {
  it("pads single digits to four places", () => {
    expect(formatFixId(1)).toBe("FIX-0001");
  });

  it("pads two digit numbers", () => {
    expect(formatFixId(42)).toBe("FIX-0042");
  });

  it("does not truncate large numbers", () => {
    expect(formatFixId(10000)).toBe("FIX-10000");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/fixes/id.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create types, paths, and id files**

Create `src/core/fixes/types.ts`:

```typescript
export const FIX_STATUS_VALUES = [
  "open",
  "in-progress",
  "resolved",
  "wont-fix",
] as const;

export type FixStatus = (typeof FIX_STATUS_VALUES)[number];

export interface FixFrontmatter {
  id: string;
  slug: string;
  status: FixStatus;
  feature: string;
  created: string;
}
```

Create `src/core/fixes/paths.ts`:

```typescript
import { join } from "node:path";
import { buildFeatureDirectoryPath } from "../specs/paths.js";

export function buildFixesDirectoryPath(
  projectRoot: string,
  featureSlug: string,
): string {
  return join(buildFeatureDirectoryPath(projectRoot, featureSlug), "fixes");
}

export function buildFixFilePath(
  projectRoot: string,
  featureSlug: string,
  id: string,
  slug: string,
): string {
  return join(
    buildFixesDirectoryPath(projectRoot, featureSlug),
    `${id}-${slug}.md`,
  );
}
```

Create `src/core/fixes/id.ts`:

```typescript
export function formatFixId(sequenceNumber: number): string {
  return `FIX-${sequenceNumber.toString().padStart(4, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/fixes/id.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/fixes/types.ts src/core/fixes/paths.ts src/core/fixes/id.ts tests/core/fixes/id.test.ts
git commit -m "feat: add fix types, paths, and id formatter"
```

---

## Task 6: Fix frontmatter reader/writer

**Files:**
- Create: `src/core/fixes/frontmatter.ts`
- Create: `tests/core/fixes/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/fixes/frontmatter.test.ts`:

```typescript
import { writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readFixFile,
  writeFixFile,
} from "../../../src/core/fixes/frontmatter.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe("writeFixFile / readFixFile", () => {
  it("round-trips a fix file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-fix-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "FIX-0001-token-expiry.md");

    await writeFixFile(filePath, {
      frontmatter: {
        id: "FIX-0001",
        slug: "token-expiry",
        status: "open",
        feature: "auth-flow",
        created: "2026-05-21T00:00:00.000Z",
      },
      body: "# token expiry\n",
    });

    const result = await readFixFile(filePath);
    expect(result.frontmatter.id).toBe("FIX-0001");
    expect(result.frontmatter.slug).toBe("token-expiry");
    expect(result.frontmatter.status).toBe("open");
    expect(result.frontmatter.feature).toBe("auth-flow");
    expect(result.frontmatter.created).toBe("2026-05-21T00:00:00.000Z");
    expect(result.body).toBe("# token expiry\n");
  });

  it("throws on missing frontmatter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "specflow-fix-fm-"));
    temporaryDirectories.push(dir);
    const filePath = join(dir, "bad.md");
    await writeFile(filePath, "no frontmatter\n", "utf8");

    await expect(readFixFile(filePath)).rejects.toThrow("missing YAML frontmatter");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/fixes/frontmatter.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement frontmatter reader/writer**

Create `src/core/fixes/frontmatter.ts`:

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { FIX_STATUS_VALUES, type FixFrontmatter } from "./types.js";

export interface FixFile {
  frontmatter: FixFrontmatter;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function isValidFixStatus(value: unknown): value is FixFrontmatter["status"] {
  return (
    typeof value === "string" &&
    (FIX_STATUS_VALUES as readonly string[]).includes(value)
  );
}

function isValidRawFixFrontmatter(
  raw: unknown,
): raw is Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["slug"] === "string" &&
    isValidFixStatus(obj["status"]) &&
    typeof obj["feature"] === "string" &&
    typeof obj["created"] === "string"
  );
}

export async function readFixFile(filePath: string): Promise<FixFile> {
  const content = await readFile(filePath, "utf8");
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    throw new Error(`Fix file at ${filePath} is missing YAML frontmatter.`);
  }

  const raw = parseYaml(match[1] ?? "") as unknown;

  if (!isValidRawFixFrontmatter(raw)) {
    throw new Error(`Fix file at ${filePath} has invalid frontmatter.`);
  }

  return {
    frontmatter: {
      id: raw["id"] as string,
      slug: raw["slug"] as string,
      status: raw["status"] as FixFrontmatter["status"],
      feature: raw["feature"] as string,
      created: raw["created"] as string,
    },
    body: match[2] ?? "",
  };
}

export async function writeFixFile(
  filePath: string,
  file: FixFile,
): Promise<void> {
  const rawFrontmatter: Record<string, unknown> = {
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    status: file.frontmatter.status,
    feature: file.frontmatter.feature,
    created: file.frontmatter.created,
  };

  const content = `---\n${stringifyYaml(rawFrontmatter)}---\n${file.body}`;
  await writeFile(filePath, content, "utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/fixes/frontmatter.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/fixes/frontmatter.ts tests/core/fixes/frontmatter.test.ts
git commit -m "feat: add fix frontmatter reader/writer"
```

---

## Task 7: Fix create function

**Files:**
- Create: `src/core/fixes/create.ts`
- Create: `tests/core/fixes/create.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/fixes/create.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/fixes/create.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement createFix**

Create `src/core/fixes/create.ts`:

```typescript
import { mkdir, readdir, stat } from "node:fs/promises";
import { buildFeatureDirectoryPath } from "../specs/paths.js";
import { writeFixFile } from "./frontmatter.js";
import { formatFixId } from "./id.js";
import { buildFixFilePath, buildFixesDirectoryPath } from "./paths.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export interface CreateFixOptions {
  projectRoot: string;
  description: string;
  featureSlug: string;
  now: string;
}

export interface CreateFixResult {
  id: string;
  filePath: string;
}

export async function createFix(
  options: CreateFixOptions,
): Promise<CreateFixResult> {
  const { projectRoot, description, featureSlug, now } = options;

  const featureDir = buildFeatureDirectoryPath(projectRoot, featureSlug);
  await stat(featureDir).catch((error: unknown) => {
    if (isMissingPathError(error)) {
      throw new Error(`Feature "${featureSlug}" does not exist.`);
    }
    throw error;
  });

  const fixesDir = buildFixesDirectoryPath(projectRoot, featureSlug);
  await mkdir(fixesDir, { recursive: true });

  const existing = await readdir(fixesDir, { withFileTypes: true });
  const mdCount = existing.filter(
    (e) => e.isFile() && e.name.endsWith(".md"),
  ).length;

  const id = formatFixId(mdCount + 1);
  const slug = slugify(description);
  const filePath = buildFixFilePath(projectRoot, featureSlug, id, slug);

  await writeFixFile(filePath, {
    frontmatter: {
      id,
      slug,
      status: "open",
      feature: featureSlug,
      created: now,
    },
    body: `# ${description}\n`,
  });

  return { id, filePath };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/fixes/create.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/fixes/create.ts tests/core/fixes/create.test.ts
git commit -m "feat: add createFix core function"
```

---

## Task 8: Fix list function

**Files:**
- Create: `src/core/fixes/list.ts`
- Create: `tests/core/fixes/list.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/fixes/list.test.ts`:

```typescript
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listFixes,
  listOpenFixes,
} from "../../../src/core/fixes/list.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

function makeFixContent(id: string, slug: string, status: string, feature: string): string {
  return `---\nid: ${id}\nslug: ${slug}\nstatus: ${status}\nfeature: ${feature}\ncreated: 2026-05-21T00:00:00.000Z\n---\n# ${slug}\n`;
}

async function scaffoldFixesDir(projectRoot: string, featureSlug: string): Promise<string> {
  const fixesDir = join(
    projectRoot,
    "docs",
    "specflow",
    "specs",
    featureSlug,
    "fixes",
  );
  await mkdir(fixesDir, { recursive: true });
  return fixesDir;
}

describe("listFixes", () => {
  it("returns empty array when fixes/ dir does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-fixes-"));
    temporaryDirectories.push(projectRoot);
    const featureDir = join(projectRoot, "docs", "specflow", "specs", "auth-flow");
    await mkdir(featureDir, { recursive: true });

    const fixes = await listFixes(projectRoot, "auth-flow");
    expect(fixes).toEqual([]);
  });

  it("returns frontmatter for each .md file in fixes/", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-fixes-"));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, "auth-flow");

    await writeFile(
      join(fixesDir, "FIX-0001-token-expiry.md"),
      makeFixContent("FIX-0001", "token-expiry", "open", "auth-flow"),
      "utf8",
    );
    await writeFile(
      join(fixesDir, "FIX-0002-null-pointer.md"),
      makeFixContent("FIX-0002", "null-pointer", "resolved", "auth-flow"),
      "utf8",
    );

    const fixes = await listFixes(projectRoot, "auth-flow");
    expect(fixes).toHaveLength(2);
    const ids = fixes.map((f) => f.id).sort();
    expect(ids).toEqual(["FIX-0001", "FIX-0002"]);
  });

  it("ignores non-.md files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-fixes-"));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, "auth-flow");

    await writeFile(
      join(fixesDir, "FIX-0001-token-expiry.md"),
      makeFixContent("FIX-0001", "token-expiry", "open", "auth-flow"),
      "utf8",
    );
    await writeFile(join(fixesDir, "notes.txt"), "ignore me", "utf8");

    const fixes = await listFixes(projectRoot, "auth-flow");
    expect(fixes).toHaveLength(1);
  });
});

describe("listOpenFixes", () => {
  it("returns only open and in-progress fixes", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-fixes-"));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, "auth-flow");

    await writeFile(
      join(fixesDir, "FIX-0001-open.md"),
      makeFixContent("FIX-0001", "open", "open", "auth-flow"),
      "utf8",
    );
    await writeFile(
      join(fixesDir, "FIX-0002-in-progress.md"),
      makeFixContent("FIX-0002", "in-progress", "in-progress", "auth-flow"),
      "utf8",
    );
    await writeFile(
      join(fixesDir, "FIX-0003-resolved.md"),
      makeFixContent("FIX-0003", "resolved", "resolved", "auth-flow"),
      "utf8",
    );
    await writeFile(
      join(fixesDir, "FIX-0004-wont-fix.md"),
      makeFixContent("FIX-0004", "wont-fix", "wont-fix", "auth-flow"),
      "utf8",
    );

    const open = await listOpenFixes(projectRoot, "auth-flow");
    expect(open).toHaveLength(2);
    const statuses = open.map((f) => f.status).sort();
    expect(statuses).toEqual(["in-progress", "open"]);
  });

  it("returns empty when all fixes are resolved or wont-fix", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-list-fixes-"));
    temporaryDirectories.push(projectRoot);
    const fixesDir = await scaffoldFixesDir(projectRoot, "auth-flow");

    await writeFile(
      join(fixesDir, "FIX-0001-resolved.md"),
      makeFixContent("FIX-0001", "resolved", "resolved", "auth-flow"),
      "utf8",
    );

    const open = await listOpenFixes(projectRoot, "auth-flow");
    expect(open).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/core/fixes/list.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement listFixes and listOpenFixes**

Create `src/core/fixes/list.ts`:

```typescript
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readFixFile } from "./frontmatter.js";
import { buildFixesDirectoryPath } from "./paths.js";
import type { FixFrontmatter } from "./types.js";

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function listFixes(
  projectRoot: string,
  featureSlug: string,
): Promise<FixFrontmatter[]> {
  const fixesDir = buildFixesDirectoryPath(projectRoot, featureSlug);

  const entries = await readdir(fixesDir, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissingPathError(error)) return [];
      throw error;
    },
  );

  const mdFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith(".md"),
  );

  const results = await Promise.all(
    mdFiles.map(async (entry) => {
      const file = await readFixFile(join(fixesDir, entry.name));
      return file.frontmatter;
    }),
  );

  return results;
}

export async function listOpenFixes(
  projectRoot: string,
  featureSlug: string,
): Promise<FixFrontmatter[]> {
  const fixes = await listFixes(projectRoot, featureSlug);
  return fixes.filter(
    (f) => f.status === "open" || f.status === "in-progress",
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/core/fixes/list.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/fixes/list.ts tests/core/fixes/list.test.ts
git commit -m "feat: add listFixes and listOpenFixes core functions"
```

---

## Task 9: `specflow fix` CLI command

**Files:**
- Create: `src/cli/commands/fix.ts`
- Modify: `src/cli/index.ts`
- Create: `tests/cli/fix.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/cli/fix.test.ts`:

```typescript
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";
import { readFixFile } from "../../src/core/fixes/frontmatter.js";

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
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

describe("fix command", () => {
  it("creates a fix file inside the feature's fixes/ dir and prints id and path", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);
    await scaffoldFeature(projectRoot, "auth-flow");

    const output: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === "string") output.push(chunk);
      return true;
    };

    try {
      await buildProgram().parseAsync([
        "node",
        "specflow",
        "fix",
        "token expiry off by one",
        "--feature",
        "auth-flow",
      ]);
    } finally {
      process.stdout.write = originalWrite;
    }

    const combined = output.join("");
    expect(combined).toContain("FIX-0001");
    expect(combined).toContain("token-expiry-off-by-one");

    const fixPath = join(
      projectRoot,
      "docs",
      "specflow",
      "specs",
      "auth-flow",
      "fixes",
      "FIX-0001-token-expiry-off-by-one.md",
    );
    const file = await readFixFile(fixPath);
    expect(file.frontmatter.feature).toBe("auth-flow");
    expect(file.frontmatter.status).toBe("open");
  });

  it("fails when --feature flag is omitted", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await expect(
      buildProgram().parseAsync([
        "node",
        "specflow",
        "fix",
        "some description",
      ]),
    ).rejects.toThrow();
  });

  it("fails when the feature slug does not exist", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "specflow-fix-cmd-"));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    await expect(
      buildProgram().parseAsync([
        "node",
        "specflow",
        "fix",
        "some description",
        "--feature",
        "nonexistent",
      ]),
    ).rejects.toThrow('Feature "nonexistent" does not exist.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/cli/fix.test.ts
```

Expected: FAIL with "unknown command 'fix'"

- [ ] **Step 3: Implement the fix command and register it**

Create `src/cli/commands/fix.ts`:

```typescript
import { Command } from "commander";
import { cwd } from "node:process";
import { createFix } from "../../core/fixes/create.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description(
      "Create a fix inside a feature's fixes/ directory (blocks finish until resolved)",
    )
    .argument("<description>", "short description of the fix")
    .requiredOption("--feature <slug>", "feature slug to attach this fix to")
    .action(async (description: string, options: { feature: string }) => {
      const result = await createFix({
        projectRoot: cwd(),
        description,
        featureSlug: options.feature,
        now: createTimestamp(),
      });

      process.stdout.write(`${result.id}  ${result.filePath}\n`);
    });
}
```

Add to `src/cli/index.ts`:

```typescript
import { registerFixCommand } from "./commands/fix.js";
```

And inside `buildProgram()`:

```typescript
registerFixCommand(program);
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- tests/cli/fix.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/fix.ts src/cli/index.ts tests/cli/fix.test.ts
git commit -m "feat: add specflow fix command"
```

---

## Task 10: `finish` blocks on open fixes

**Files:**
- Modify: `src/cli/commands/finish.ts`
- Modify: `tests/cli/finish.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/cli/finish.test.ts` inside `describe("finish command")`:

```typescript
it("fails when there are open fixes", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "specflow-finish-"));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);

  const tasksDir = await scaffoldInProgressFeature(projectRoot);
  await writeFile(
    join(tasksDir, "setup-db.md"),
    "---\nid: TASK-001\nslug: setup-db\nstatus: done\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
    "utf8",
  );

  const fixesDir = join(
    projectRoot,
    "docs",
    "specflow",
    "specs",
    "user-auth",
    "fixes",
  );
  await mkdir(fixesDir, { recursive: true });
  await writeFile(
    join(fixesDir, "FIX-0001-token-expiry.md"),
    "---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n",
    "utf8",
  );

  const stderrOutput: string[] = [];
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === "string") stderrOutput.push(chunk);
    return true;
  };

  try {
    await buildProgram().parseAsync(["node", "specflow", "finish", "user-auth"]);
  } finally {
    process.stderr.write = originalStderrWrite;
  }

  expect(process.exitCode).toBe(1);
  process.exitCode = 0;

  const combined = stderrOutput.join("");
  expect(combined).toContain("Cannot finish user-auth");
  expect(combined).toContain("FIX-0001");
  expect(combined).toContain("open");
  expect(combined).toContain("Resolve or mark wont-fix before finishing.");
});

it("succeeds when all fixes are resolved or wont-fix", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "specflow-finish-"));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);

  const tasksDir = await scaffoldInProgressFeature(projectRoot);
  await writeFile(
    join(tasksDir, "setup-db.md"),
    "---\nid: TASK-001\nslug: setup-db\nstatus: done\nparallel: false\ndepends-on: []\n---\n# Setup DB\n",
    "utf8",
  );

  const fixesDir = join(
    projectRoot,
    "docs",
    "specflow",
    "specs",
    "user-auth",
    "fixes",
  );
  await mkdir(fixesDir, { recursive: true });
  await writeFile(
    join(fixesDir, "FIX-0001-token-expiry.md"),
    "---\nid: FIX-0001\nslug: token-expiry\nstatus: resolved\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n",
    "utf8",
  );

  await buildProgram().parseAsync(["node", "specflow", "finish", "user-auth"]);

  const featureDir = join(projectRoot, "docs", "specflow", "specs", "user-auth");
  const { readFile } = await import("node:fs/promises");
  const metadata = JSON.parse(
    await readFile(join(featureDir, ".specflow.json"), "utf8"),
  ) as { status: string };
  expect(metadata.status).toBe("done");
});
```

Also add `mkdir` to the import line at the top of `tests/cli/finish.test.ts` if not already there (it already uses `mkdir` in the scaffold helper, so check).

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/cli/finish.test.ts
```

Expected: The new "fails when there are open fixes" test should FAIL (finish currently ignores fixes)

- [ ] **Step 3: Update finish command**

Replace the content of `src/cli/commands/finish.ts`:

```typescript
import { Command } from "commander";
import { cwd } from "node:process";
import { listOpenFixes } from "../../core/fixes/list.js";
import { updateFeatureStatus } from "../../core/specs/transition.js";

function createTimestamp(): string {
  return new Date().toISOString();
}

export function registerFinishCommand(program: Command): void {
  program
    .command("finish")
    .description(
      "Mark a feature as done (requires all tasks done and no open fixes)",
    )
    .argument("<slug>", "feature folder slug")
    .action(async (slug: string) => {
      const projectRoot = cwd();
      const openFixes = await listOpenFixes(projectRoot, slug);

      if (openFixes.length > 0) {
        const fixLines = openFixes
          .map((f) => `  ${f.id}  ${f.status}  ${f.slug}`)
          .join("\n");
        process.stderr.write(
          `Cannot finish ${slug}: ${openFixes.length} open fix${openFixes.length === 1 ? "" : "es"}\n\n${fixLines}\n\nResolve or mark wont-fix before finishing.\n`,
        );
        process.exitCode = 1;
        return;
      }

      await updateFeatureStatus(projectRoot, slug, "done", createTimestamp());
      process.stdout.write(`feature ${slug} marked as done\n`);
    });
}
```

- [ ] **Step 4: Run all finish tests to verify they pass**

```
npm test -- tests/cli/finish.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/finish.ts tests/cli/finish.test.ts
git commit -m "feat: block finish when open fixes exist"
```

---

## Task 11: `list` shows open fix count

**Files:**
- Modify: `src/cli/commands/list.ts`
- Modify: `tests/cli/list.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/cli/list.test.ts` inside `describe("list command")`:

```typescript
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
  expect(combined).toContain("2 open fixes");
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
  expect(combined).toContain("-");
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/cli/list.test.ts
```

Expected: new tests FAIL (list currently doesn't show fix count)

- [ ] **Step 3: Update list command**

Replace `src/cli/commands/list.ts`:

```typescript
import { Command } from "commander";
import { cwd } from "node:process";
import { listOpenFixes } from "../../core/fixes/list.js";
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

      const listOptions = { projectRoot: cwd() };
      if (statusFilter !== undefined) {
        (listOptions as { status?: FeatureStatus }).status = statusFilter;
      }
      const features = await listFeatures(listOptions);

      for (const feature of features) {
        const title = feature.title ?? "";
        const openFixes = await listOpenFixes(cwd(), feature.slug);
        const fixesLabel =
          openFixes.length > 0
            ? `${openFixes.length} open fix${openFixes.length === 1 ? "" : "es"}`
            : "-";
        process.stdout.write(
          `${feature.id}\t${feature.slug}\t${feature.status}\t${fixesLabel}\t${title}\n`,
        );
      }
    });
}
```

- [ ] **Step 4: Run all list tests to verify they pass**

```
npm test -- tests/cli/list.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/list.ts tests/cli/list.test.ts
git commit -m "feat: show open fix count in specflow list"
```

---

## Task 12: `status` shows fixes block

**Files:**
- Modify: `src/cli/commands/status.ts`
- Modify: `tests/cli/status.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/cli/status.test.ts` inside `describe("status command")`:

```typescript
it("prints fixes block when feature has open fixes", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "specflow-status-cmd-"));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);

  const featureDir = join(projectRoot, "docs", "specflow", "specs", "user-auth");
  const fixesDir = join(featureDir, "fixes");
  await mkdir(fixesDir, { recursive: true });
  await writeFile(
    join(featureDir, ".specflow.json"),
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
  await writeFile(
    join(fixesDir, "FIX-0001-token-expiry.md"),
    "---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n",
    "utf8",
  );
  await writeFile(
    join(fixesDir, "FIX-0002-null-ptr.md"),
    "---\nid: FIX-0002\nslug: null-ptr\nstatus: in-progress\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# null ptr\n",
    "utf8",
  );

  const output: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === "string") output.push(chunk);
    return true;
  };

  try {
    await buildProgram().parseAsync(["node", "specflow", "status", "user-auth"]);
  } finally {
    process.stdout.write = originalWrite;
  }

  const combined = output.join("");
  expect(combined).toContain("fixes:");
  expect(combined).toContain("FIX-0001");
  expect(combined).toContain("token-expiry");
  expect(combined).toContain("FIX-0002");
  expect(combined).toContain("null-ptr");
});

it("omits fixes block when feature has no fixes", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "specflow-status-cmd-"));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);

  const featureDir = join(projectRoot, "docs", "specflow", "specs", "user-auth");
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, ".specflow.json"),
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
    await buildProgram().parseAsync(["node", "specflow", "status", "user-auth"]);
  } finally {
    process.stdout.write = originalWrite;
  }

  const combined = output.join("");
  expect(combined).not.toContain("fixes:");
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- tests/cli/status.test.ts
```

Expected: new tests FAIL

- [ ] **Step 3: Update status command**

Replace `src/cli/commands/status.ts`:

```typescript
import { Command } from "commander";
import { cwd } from "node:process";
import { listFixes } from "../../core/fixes/list.js";
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
      const fixes = await listFixes(projectRoot, slug);

      const { metadata, artifacts } = lifecycle;
      const title = metadata.title !== undefined ? ` (${metadata.title})` : "";

      process.stdout.write(`slug:    ${metadata.slug}${title}\n`);
      process.stdout.write(`id:      ${metadata.id}\n`);
      process.stdout.write(`status:  ${metadata.status}\n`);
      process.stdout.write(`\n`);
      process.stdout.write(
        `spec.md:          ${artifacts.specExists ? "present" : "missing"}\n`,
      );
      process.stdout.write(
        `architecture.md:  ${artifacts.architectureExists ? "present" : "missing"}\n`,
      );
      process.stdout.write(
        `tasks:            ${artifacts.taskFileCount} file${artifacts.taskFileCount === 1 ? "" : "s"}\n`,
      );

      if (tasks.length > 0) {
        process.stdout.write(`\n`);
        for (const task of tasks) {
          process.stdout.write(`  ${task.slug}\t${task.status}\n`);
        }
      }

      if (fixes.length > 0) {
        process.stdout.write(`\nfixes:\n`);
        for (const fix of fixes) {
          process.stdout.write(`  ${fix.id}  ${fix.status}  ${fix.slug}\n`);
        }
      }
    });
}
```

- [ ] **Step 4: Run all status tests to verify they pass**

```
npm test -- tests/cli/status.test.ts
```

Expected: all PASS

- [ ] **Step 5: Run full test suite to verify nothing broken**

```
npm test
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/status.ts tests/cli/status.test.ts
git commit -m "feat: show fixes block in specflow status"
```
