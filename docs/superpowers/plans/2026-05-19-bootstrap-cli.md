# Bootstrap CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial production-ready `scifi` CLI scaffold with strict TypeScript, Commander-based command wiring, Vitest test setup, repository quality docs, and the first foundation for `scifi init`.

**Architecture:** This remains a single publishable npm package with clear separation between CLI wiring and domain logic. Command registration lives in `src/cli`, scaffolding logic lives in `src/core`, templates live in `src/templates`, and verification is enforced through automated tests plus an installed-build sandbox workflow.

**Tech Stack:** Node.js, TypeScript, Commander, Vitest, npm

---

### Task 1: Package and TypeScript Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Write the failing build expectation by defining the required package shape**

Package file must support a published CLI package:

```json
{
  "name": "scifi",
  "version": "0.1.0",
  "description": "Specification-driven CLI scaffolding for agentic workflows",
  "type": "module",
  "bin": {
    "scifi": "./dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "AGENTS.md",
    "ROADMAP.md",
    "TESTING.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  }
}
```

The initial failure condition is simple: `npm run build` cannot work until `tsconfig.json` and source files exist.

- [ ] **Step 2: Add strict TypeScript configuration**

Create a strict compiler config with output to `dist/`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": false,
    "skipLibCheck": false
  },
  "include": [
    "src/**/*.ts"
  ]
}
```

- [ ] **Step 3: Add baseline ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.testing/artifacts/
```

- [ ] **Step 4: Run build to verify the expected initial failure**

Run: `npm run build`
Expected: FAIL because `src/` does not yet contain the CLI entrypoint.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "chore: add package and tsconfig foundation"
```

### Task 2: CLI Entry and Command Wiring

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/commands/init.ts`
- Test: `tests/cli/index.test.ts`

- [ ] **Step 1: Write the failing CLI integration test**

Create the first CLI test:

```ts
import { describe, expect, it } from "vitest";
import { buildProgram } from "../../src/cli/index.js";

describe("buildProgram", () => {
  it("registers the init command", () => {
    const program = buildProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain("init");
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/cli/index.test.ts`
Expected: FAIL because `src/cli/index.ts` does not exist.

- [ ] **Step 3: Add the minimal CLI entrypoint and init command registration**

Create `src/cli/index.ts`:

```ts
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("scifi")
    .description("Specification-driven CLI scaffolding for agentic workflows")
    .version("0.1.0");

  registerInitCommand(program);

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildProgram().parseAsync(process.argv);
}
```

Create `src/cli/commands/init.ts`:

```ts
import { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize scifi in the current repository")
    .action(async () => {
      process.stdout.write("scifi init is not implemented yet\n");
    });
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `npm test -- --run tests/cli/index.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck and build**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/index.ts src/cli/commands/init.ts tests/cli/index.test.ts
git commit -m "feat: add CLI entrypoint and init command"
```

### Task 3: Test Harness and Coverage Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json`
- Test: `tests/cli/index.test.ts`

- [ ] **Step 1: Write the failing coverage expectation**

Add coverage script use and a test setup entry so the repo can enforce the testing policy:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"]
  }
});
```

The initial failure is that `tests/setup.ts` does not yet exist.

- [ ] **Step 2: Run tests to confirm failure**

Run: `npm test`
Expected: FAIL because Vitest cannot load `tests/setup.ts`.

- [ ] **Step 3: Add the minimal setup and coverage config**

Create `tests/setup.ts`:

```ts
import { afterEach } from "vitest";

afterEach(() => {
  process.env = { ...process.env };
});
```

Update `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  }
});
```

- [ ] **Step 4: Run tests and coverage**

Run: `npm test`
Expected: PASS

Run: `npm run coverage`
Expected: PASS and a coverage report is generated

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json
git commit -m "test: add vitest config and coverage setup"
```

### Task 4: Core Init Scaffolding Logic

**Files:**
- Create: `src/core/init/scaffold.ts`
- Create: `src/core/init/types.ts`
- Test: `tests/core/init/scaffold.test.ts`

- [ ] **Step 1: Write the failing scaffolding test**

Create:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeScifi } from "../../../src/core/init/scaffold.js";

describe("initializeScifi", () => {
  it("creates the base directories and docs", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "scifi-init-"));

    await initializeScifi({ rootDir });

    expect(readFileSync(join(rootDir, "AGENTS.md"), "utf8")).toContain("production-ready");
    expect(readFileSync(join(rootDir, "TESTING.md"), "utf8")).toContain("release gate");
    expect(readFileSync(join(rootDir, "ROADMAP.md"), "utf8")).toContain("Current sub-project");
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/core/init/scaffold.test.ts`
Expected: FAIL because the scaffolding module does not exist.

- [ ] **Step 3: Add minimal init scaffolding implementation**

Create `src/core/init/types.ts`:

```ts
export interface InitializeScifiOptions {
  rootDir: string;
}
```

Create `src/core/init/scaffold.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { InitializeScifiOptions } from "./types.js";

const AGENTS_CONTENT = `# AGENTS.md

This repository is building \`scifi\` as a production-ready developer tool, not a throwaway prototype.
`;

const TESTING_CONTENT = `# TESTING.md

This repository treats testing as a release gate, not a cleanup step.
`;

const ROADMAP_CONTENT = `# Roadmap

## Current Focus

Current sub-project: \`Bootstrap CLI\`
`;

export async function initializeScifi(
  options: InitializeScifiOptions
): Promise<void> {
  await mkdir(join(options.rootDir, ".scifi"), { recursive: true });
  await mkdir(join(options.rootDir, "specs"), { recursive: true });
  await mkdir(join(options.rootDir, "bugs"), { recursive: true });

  await writeFile(join(options.rootDir, "AGENTS.md"), AGENTS_CONTENT);
  await writeFile(join(options.rootDir, "TESTING.md"), TESTING_CONTENT);
  await writeFile(join(options.rootDir, "ROADMAP.md"), ROADMAP_CONTENT);
}
```

- [ ] **Step 4: Run the targeted test**

Run: `npm test -- --run tests/core/init/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/init/types.ts src/core/init/scaffold.ts tests/core/init/scaffold.test.ts
git commit -m "feat: add base init scaffolding logic"
```

### Task 5: Wire `scifi init` to Core Logic

**Files:**
- Modify: `src/cli/commands/init.ts`
- Test: `tests/cli/init.test.ts`

- [ ] **Step 1: Write the failing end-to-end init test**

Create:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram } from "../../src/cli/index.js";

describe("scifi init", () => {
  it("creates the base project structure", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "scifi-cli-"));
    const originalCwd = process.cwd();

    process.chdir(rootDir);

    try {
      await buildProgram().parseAsync(["node", "scifi", "init"]);
    } finally {
      process.chdir(originalCwd);
    }

    expect(existsSync(join(rootDir, ".scifi"))).toBe(true);
    expect(existsSync(join(rootDir, "specs"))).toBe(true);
    expect(existsSync(join(rootDir, "bugs"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/cli/init.test.ts`
Expected: FAIL because the command does not yet scaffold files.

- [ ] **Step 3: Replace placeholder init behavior with real core wiring**

Update `src/cli/commands/init.ts`:

```ts
import { Command } from "commander";
import { initializeScifi } from "../../core/init/scaffold.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize scifi in the current repository")
    .action(async () => {
      await initializeScifi({ rootDir: process.cwd() });
      process.stdout.write("Initialized scifi in the current repository\n");
    });
}
```

- [ ] **Step 4: Run the targeted test and the full test suite**

Run: `npm test -- --run tests/cli/init.test.ts`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/init.ts tests/cli/init.test.ts
git commit -m "feat: wire init command to scaffolding logic"
```

### Task 6: Dedicated Installed-Build Verification Workspace

**Files:**
- Create: `.testing/sandboxes/.gitkeep`
- Create: `.testing/artifacts/.gitkeep`
- Create: `tests/e2e/installed-init.test.ts`
- Modify: `TESTING.md`

- [ ] **Step 1: Write the failing installed-build test plan**

Create an end-to-end verification test that shells out to the built CLI entry:

```ts
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("installed build verification", () => {
  it("runs init through the built CLI entry", async () => {
    const result = await execFileAsync("node", ["dist/cli/index.js", "init"], {
      cwd: ".testing/sandboxes/installed-cli"
    });

    expect(result.stdout).toContain("Initialized scifi");
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm failure**

Run: `npm test -- --run tests/e2e/installed-init.test.ts`
Expected: FAIL because the sandbox and built artifacts are not prepared yet.

- [ ] **Step 3: Add the verification workspace structure**

Create:

```text
.testing/
├── artifacts/
│   └── .gitkeep
└── sandboxes/
    ├── .gitkeep
    └── installed-cli/
```

Also update `TESTING.md` so this structure is documented as the standard verification location for installed-build checks.

- [ ] **Step 4: Run build and installed-build verification**

Run: `npm run build`
Expected: PASS

Run: `node dist/cli/index.js init`
Working directory: `.testing/sandboxes/installed-cli`
Expected: PASS and base files/folders are created in the sandbox

- [ ] **Step 5: Run the installed-build e2e test**

Run: `npm test -- --run tests/e2e/installed-init.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .testing tests/e2e/installed-init.test.ts TESTING.md
git commit -m "test: add installed build verification workspace"
```

### Task 7: Final Repository Verification and Documentation Pass

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Write or update the README with bootstrap usage**

Add a minimal usage section that shows:

```md
## Development

```bash
npm install
npm run build
npm test
```

## Bootstrap Verification

```bash
cd .testing/sandboxes/installed-cli
node ../../../dist/cli/index.js init
```
```

- [ ] **Step 2: Run full verification**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npm test`
Expected: PASS

Run: `npm run coverage`
Expected: PASS

Run installed-build check in `.testing/sandboxes/installed-cli`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add README.md AGENTS.md ROADMAP.md
git commit -m "docs: finalize bootstrap CLI documentation"
```
