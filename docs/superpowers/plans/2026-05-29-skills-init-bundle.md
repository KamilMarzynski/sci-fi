# Skills Init Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle the `sf-*` user skills and `*-review`/`tdd`/`verification` subagents inside the `specflow` package and install them per-harness during `specflow init`.

**Architecture:** Author each skill as a `skills/<id>/{body.md, manifest.ts}` pair (single source of truth). At init time, a catalog loader reads the bundle and a harness adapter composes per-harness output (frontmatter + path). Only Claude Code is implemented in scope; the registry throws `HarnessNotImplementedError` for the rest. Scaffolded docs grow from 2 to 4 (`EVALUATION.md` replaces `TESTING.md`; `ARCHITECTURE.md` and `CONTEXT.md` are new).

**Tech Stack:** Node.js 20+, TypeScript (strict, NodeNext), Commander, vitest, `yaml` for serializing frontmatter, `node:readline/promises` for the interactive harness prompt (no new dependencies).

**Reference spec:** `docs/superpowers/specs/2026-05-29-skills-init-bundle-design.md`.

---

## File Structure

**Created:**
- `src/core/skills/types.ts` — `SkillKind`, `SkillManifest`, `SkillBundle`
- `src/core/skills/catalog.ts` — `loadCatalog(packageRoot)` reads `skills/<id>/body.md` + compiled manifest
- `src/core/skills/harness/adapter.ts` — `HarnessId`, `HarnessAdapter`, `HarnessNotImplementedError`, `InvalidHarnessError`
- `src/core/skills/harness/registry.ts` — `getAdapter(id)` returns adapter or throws
- `src/core/skills/harness/claude-code.ts` — Claude Code adapter (user → `.claude/skills/<id>/SKILL.md`, subagent → `.claude/agents/<id>.md`)
- `src/core/init/prompt-harness.ts` — `resolveHarness({ flag, yes, ask })`
- `src/core/init/install-skills.ts` — `installSkills({ projectRoot, harness, packageRoot })`
- `src/core/init/config.ts` — `writeConfig({ projectRoot, harness })`
- `skills/sf-feature/{body.md, manifest.ts}` (+ 9 more siblings)
- `tests/core/skills/harness/claude-code.test.ts`
- `tests/core/skills/harness/registry.test.ts`
- `tests/core/skills/catalog.test.ts`
- `tests/core/init/prompt-harness.test.ts`
- `tests/core/init/install-skills.test.ts`
- `tests/core/init/config.test.ts`

**Modified:**
- `package.json` — `files[]`, `exports`, harness-related metadata
- `tsconfig.json` — `rootDir` → `rootDirs`, `include`, `paths`
- `src/core/init/types.ts` — add `harness?: HarnessId`
- `src/core/init/scaffold.ts` — replace TESTING with EVALUATION; add ARCHITECTURE, CONTEXT
- `src/cli/commands/init.ts` — `--harness`, `--yes` flags; call prompt, install, config
- `tests/core/init/scaffold.test.ts` — new docs, dropped TESTING expectations
- `tests/e2e/installed-init.test.ts` — new docs, `--harness claude-code`, not-implemented case

---

## Task 1: Skill type definitions

**Files:**
- Create: `src/core/skills/types.ts`

- [ ] **Step 1: Create the types module**

Write `src/core/skills/types.ts`:

```ts
export type SkillKind = "user" | "subagent";

export interface SkillManifest {
  readonly id: string;
  readonly kind: SkillKind;
  readonly description: string;
  readonly argumentHint?: string;
  readonly allowedTools?: readonly string[];
  readonly disableModelInvocation?: boolean;
  readonly model?: string;
}

export interface SkillBundle {
  readonly manifest: SkillManifest;
  readonly body: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no other code depends on the types yet).

- [ ] **Step 3: Commit**

```bash
git add src/core/skills/types.ts
git commit -m "feat(skills): add SkillManifest and SkillBundle types"
```

---

## Task 2: Package self-reference exports and tsconfig

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

This task wires the `specflow/skill-types` subpath so authored manifests can `import type { SkillManifest } from "specflow/skill-types"` in both source (via tsconfig `paths`) and compiled output (via `package.json` `exports`).

- [ ] **Step 1: Update `package.json`**

Replace the `"files"` entry and add `"exports"` immediately after `"bin"`:

```json
  "bin": {
    "specflow": "./dist/cli/index.js"
  },
  "exports": {
    ".": "./dist/cli/index.js",
    "./skill-types": {
      "types": "./dist/core/skills/types.d.ts",
      "default": "./dist/core/skills/types.js"
    }
  },
  "files": [
    "dist",
    "skills"
  ],
```

- [ ] **Step 2: Update `tsconfig.json`**

Replace the file contents with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDirs": ["src", "skills"],
    "baseUrl": ".",
    "paths": {
      "specflow/skill-types": ["src/core/skills/types.ts"]
    },
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": false,
    "skipLibCheck": false
  },
  "include": [
    "src/**/*.ts",
    "skills/**/manifest.ts"
  ]
}
```

`rootDirs` lets `src/` and `skills/` map into the same `dist/` root so compiled manifests land at `dist/skills/<id>/manifest.js` and the types module at `dist/core/skills/types.js`. The TypeScript `paths` entry resolves the self-reference subpath to the source `.ts` file during type-checking and emit; the matching `package.json` `exports` entry resolves it at runtime.

- [ ] **Step 3: Build to confirm the layout**

Run: `npm run build`
Expected: PASS. After build, verify the layout:

Run: `ls dist/core/skills/types.js dist/cli/index.js`
Expected: both files exist.

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore(skills): add specflow/skill-types subpath export and skills rootDir"
```

---

## Task 3: Harness adapter interface and errors

**Files:**
- Create: `src/core/skills/harness/adapter.ts`

- [ ] **Step 1: Create the adapter module**

Write `src/core/skills/harness/adapter.ts`:

```ts
import type { SkillBundle } from "../types.js";

export type HarnessId =
  | "claude-code"
  | "opencode"
  | "codex"
  | "cursor"
  | "agents-md";

export const KNOWN_HARNESS_IDS: readonly HarnessId[] = [
  "claude-code",
  "opencode",
  "codex",
  "cursor",
  "agents-md",
];

export interface HarnessAdapter {
  readonly id: HarnessId;
  install(
    bundles: readonly SkillBundle[],
    projectRoot: string,
  ): Promise<void>;
}

export class InvalidHarnessError extends Error {
  constructor(value: string) {
    super(
      `Unknown harness "${value}". Expected one of: ${KNOWN_HARNESS_IDS.join(
        ", ",
      )}.`,
    );
    this.name = "InvalidHarnessError";
  }
}

export class HarnessNotImplementedError extends Error {
  constructor(public readonly harness: HarnessId) {
    super(
      `Harness "${harness}" is not implemented yet. Track progress at https://github.com/${"<owner>/specflow"}/issues.`,
    );
    this.name = "HarnessNotImplementedError";
  }
}

export function isHarnessId(value: string): value is HarnessId {
  return (KNOWN_HARNESS_IDS as readonly string[]).includes(value);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/skills/harness/adapter.ts
git commit -m "feat(skills): add harness adapter interface and error types"
```

---

## Task 4: Harness registry

**Files:**
- Create: `src/core/skills/harness/registry.ts`
- Create: `tests/core/skills/harness/registry.test.ts`

The registry knows which harnesses have adapters. Claude Code's adapter is registered in Task 6; this task ships the registry skeleton with a placeholder.

- [ ] **Step 1: Write the failing tests**

Write `tests/core/skills/harness/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  HarnessNotImplementedError,
  InvalidHarnessError,
} from "../../../../src/core/skills/harness/adapter.js";
import { getAdapter } from "../../../../src/core/skills/harness/registry.js";

describe("getAdapter", () => {
  it("throws InvalidHarnessError for an unknown harness id", () => {
    expect(() => getAdapter("nope" as never)).toThrowError(InvalidHarnessError);
  });

  it("throws HarnessNotImplementedError for opencode", () => {
    expect(() => getAdapter("opencode")).toThrowError(
      HarnessNotImplementedError,
    );
  });

  it("throws HarnessNotImplementedError for codex", () => {
    expect(() => getAdapter("codex")).toThrowError(HarnessNotImplementedError);
  });

  it("throws HarnessNotImplementedError for cursor", () => {
    expect(() => getAdapter("cursor")).toThrowError(HarnessNotImplementedError);
  });

  it("throws HarnessNotImplementedError for agents-md", () => {
    expect(() => getAdapter("agents-md")).toThrowError(
      HarnessNotImplementedError,
    );
  });

  it("throws HarnessNotImplementedError for claude-code until Task 6 registers it", () => {
    expect(() => getAdapter("claude-code")).toThrowError(
      HarnessNotImplementedError,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/skills/harness/registry.test.ts`
Expected: FAIL — module `registry.js` does not exist.

- [ ] **Step 3: Implement the registry**

Write `src/core/skills/harness/registry.ts`:

```ts
import {
  HarnessNotImplementedError,
  InvalidHarnessError,
  isHarnessId,
  type HarnessAdapter,
  type HarnessId,
} from "./adapter.js";

type RegistryEntry = HarnessAdapter | "not-implemented";

const registry: Record<HarnessId, RegistryEntry> = {
  "claude-code": "not-implemented",
  opencode: "not-implemented",
  codex: "not-implemented",
  cursor: "not-implemented",
  "agents-md": "not-implemented",
};

export function registerAdapter(adapter: HarnessAdapter): void {
  registry[adapter.id] = adapter;
}

export function getAdapter(id: string): HarnessAdapter {
  if (!isHarnessId(id)) {
    throw new InvalidHarnessError(id);
  }

  const entry = registry[id];

  if (entry === "not-implemented") {
    throw new HarnessNotImplementedError(id);
  }

  return entry;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/skills/harness/registry.test.ts`
Expected: PASS for all six cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/skills/harness/registry.ts tests/core/skills/harness/registry.test.ts
git commit -m "feat(skills): add harness adapter registry"
```

---

## Task 5: Claude Code adapter — user skills

**Files:**
- Create: `src/core/skills/harness/claude-code.ts`
- Create: `tests/core/skills/harness/claude-code.test.ts`

User skills land at `<projectRoot>/.claude/skills/<id>/SKILL.md`. Frontmatter omits absent optional fields.

- [ ] **Step 1: Write the failing test**

Write `tests/core/skills/harness/claude-code.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { claudeCodeAdapter } from "../../../../src/core/skills/harness/claude-code.js";
import type { SkillBundle } from "../../../../src/core/skills/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

function createProjectRoot(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), "specflow-cc-adapter-"));
  temporaryDirectories.push(projectRoot);
  return projectRoot;
}

describe("claudeCodeAdapter — user skills", () => {
  it("writes .claude/skills/<id>/SKILL.md with full frontmatter and body", async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: "sf-feature",
        kind: "user",
        description: "Start grilling session for a new feature.",
        argumentHint: "[title]",
        allowedTools: ["Read", "Write"],
        disableModelInvocation: true,
      },
      body: "# sf-feature\n\nstub body\n",
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, ".claude", "skills", "sf-feature", "SKILL.md"),
      "utf8",
    );
    const [frontmatterBlock, ...bodyLines] = splitFrontmatter(written);
    const frontmatter = parse(frontmatterBlock);

    expect(frontmatter).toEqual({
      name: "sf-feature",
      description: "Start grilling session for a new feature.",
      "argument-hint": "[title]",
      "allowed-tools": "Read, Write",
      "disable-model-invocation": true,
    });
    expect(bodyLines.join("\n")).toBe("# sf-feature\n\nstub body\n");
  });

  it("omits optional frontmatter keys when not provided", async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: "sf-bug",
        kind: "user",
        description: "Create a bug report.",
      },
      body: "# sf-bug\n",
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, ".claude", "skills", "sf-bug", "SKILL.md"),
      "utf8",
    );
    const [frontmatterBlock] = splitFrontmatter(written);
    const frontmatter = parse(frontmatterBlock);

    expect(frontmatter).toEqual({
      name: "sf-bug",
      description: "Create a bug report.",
    });
  });
});

function splitFrontmatter(contents: string): [string, string] {
  const trimmed = contents.startsWith("---\n") ? contents.slice(4) : contents;
  const closingIndex = trimmed.indexOf("\n---\n");

  if (closingIndex === -1) {
    throw new Error("Missing closing frontmatter marker");
  }

  return [trimmed.slice(0, closingIndex), trimmed.slice(closingIndex + 5)];
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/skills/harness/claude-code.test.ts`
Expected: FAIL — module `claude-code.js` does not exist.

- [ ] **Step 3: Implement the adapter**

Write `src/core/skills/harness/claude-code.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import type { SkillBundle, SkillManifest } from "../types.js";
import type { HarnessAdapter } from "./adapter.js";

export const claudeCodeAdapter: HarnessAdapter = {
  id: "claude-code",
  async install(bundles, projectRoot) {
    for (const bundle of bundles) {
      const targetPath = resolveTargetPath(bundle.manifest, projectRoot);
      const document = renderDocument(bundle);

      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, document, { encoding: "utf8" });
    }
  },
};

function resolveTargetPath(
  manifest: SkillManifest,
  projectRoot: string,
): string {
  if (manifest.kind === "subagent") {
    return join(projectRoot, ".claude", "agents", `${manifest.id}.md`);
  }

  return join(
    projectRoot,
    ".claude",
    "skills",
    manifest.id,
    "SKILL.md",
  );
}

function renderDocument(bundle: SkillBundle): string {
  const frontmatter = buildFrontmatter(bundle.manifest);
  const serialized = stringify(frontmatter).trimEnd();

  return `---\n${serialized}\n---\n${bundle.body}`;
}

function buildFrontmatter(manifest: SkillManifest): Record<string, unknown> {
  if (manifest.kind === "subagent") {
    return buildSubagentFrontmatter(manifest);
  }

  return buildUserFrontmatter(manifest);
}

function buildUserFrontmatter(
  manifest: SkillManifest,
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    name: manifest.id,
    description: manifest.description,
  };

  if (manifest.argumentHint !== undefined) {
    frontmatter["argument-hint"] = manifest.argumentHint;
  }

  if (manifest.allowedTools !== undefined) {
    frontmatter["allowed-tools"] = manifest.allowedTools.join(", ");
  }

  if (manifest.disableModelInvocation === true) {
    frontmatter["disable-model-invocation"] = true;
  }

  return frontmatter;
}

function buildSubagentFrontmatter(
  manifest: SkillManifest,
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    name: manifest.id,
    description: manifest.description,
  };

  if (manifest.allowedTools !== undefined) {
    frontmatter.tools = manifest.allowedTools.join(", ");
  }

  if (manifest.model !== undefined) {
    frontmatter.model = manifest.model;
  }

  return frontmatter;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/skills/harness/claude-code.test.ts`
Expected: PASS (both user-skill cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/skills/harness/claude-code.ts tests/core/skills/harness/claude-code.test.ts
git commit -m "feat(skills): add Claude Code adapter for user skills"
```

---

## Task 6: Claude Code adapter — subagents + registry wiring

**Files:**
- Modify: `tests/core/skills/harness/claude-code.test.ts`
- Modify: `src/core/skills/harness/registry.ts`
- Modify: `tests/core/skills/harness/registry.test.ts`

Subagent rendering already exists in `claude-code.ts`. Add tests, then register the adapter so the registry returns it instead of throwing `HarnessNotImplementedError`.

- [ ] **Step 1: Add the failing subagent test**

Append to `tests/core/skills/harness/claude-code.test.ts` after the existing `describe`:

```ts
describe("claudeCodeAdapter — subagents", () => {
  it("writes .claude/agents/<id>.md with subagent frontmatter", async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: "code-review",
        kind: "subagent",
        description: "Quality review of changes.",
        allowedTools: ["Read", "Grep"],
        model: "inherit",
      },
      body: "# code-review\n\nstub body\n",
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, ".claude", "agents", "code-review.md"),
      "utf8",
    );
    const [frontmatterBlock, body] = splitFrontmatter(written);
    const frontmatter = parse(frontmatterBlock);

    expect(frontmatter).toEqual({
      name: "code-review",
      description: "Quality review of changes.",
      tools: "Read, Grep",
      model: "inherit",
    });
    expect(body).toBe("# code-review\n\nstub body\n");
  });

  it("omits optional subagent keys when not provided", async () => {
    const projectRoot = createProjectRoot();
    const bundle: SkillBundle = {
      manifest: {
        id: "verification",
        kind: "subagent",
        description: "Verify implementation matches spec.",
      },
      body: "# verification\n",
    };

    await claudeCodeAdapter.install([bundle], projectRoot);

    const written = readFileSync(
      join(projectRoot, ".claude", "agents", "verification.md"),
      "utf8",
    );
    const [frontmatterBlock] = splitFrontmatter(written);

    expect(parse(frontmatterBlock)).toEqual({
      name: "verification",
      description: "Verify implementation matches spec.",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify the new cases pass already**

Run: `npx vitest run tests/core/skills/harness/claude-code.test.ts`
Expected: PASS (the rendering already covers subagent kind; this locks behavior in a test).

- [ ] **Step 3: Update the registry test for claude-code**

In `tests/core/skills/harness/registry.test.ts`, replace the test:

```ts
  it("throws HarnessNotImplementedError for claude-code until Task 6 registers it", () => {
    expect(() => getAdapter("claude-code")).toThrowError(
      HarnessNotImplementedError,
    );
  });
```

with:

```ts
  it("returns the Claude Code adapter for claude-code", () => {
    const adapter = getAdapter("claude-code");

    expect(adapter.id).toBe("claude-code");
  });
```

Also add the import at the top of the file:

```ts
import "../../../../src/core/skills/harness/register-defaults.js";
```

- [ ] **Step 4: Run registry tests to verify they fail**

Run: `npx vitest run tests/core/skills/harness/registry.test.ts`
Expected: FAIL — `register-defaults.js` does not exist.

- [ ] **Step 5: Add the default registration module**

Write `src/core/skills/harness/register-defaults.ts`:

```ts
import { claudeCodeAdapter } from "./claude-code.js";
import { registerAdapter } from "./registry.js";

registerAdapter(claudeCodeAdapter);
```

- [ ] **Step 6: Run registry tests to verify they pass**

Run: `npx vitest run tests/core/skills/harness/registry.test.ts`
Expected: PASS — claude-code now returns the adapter; the remaining four still throw `HarnessNotImplementedError`.

- [ ] **Step 7: Commit**

```bash
git add src/core/skills/harness/register-defaults.ts tests/core/skills/harness/claude-code.test.ts tests/core/skills/harness/registry.test.ts
git commit -m "feat(skills): register Claude Code adapter and lock subagent rendering"
```

---

## Task 7: Catalog loader

**Files:**
- Create: `src/core/skills/catalog.ts`
- Create: `tests/core/skills/catalog.test.ts`
- Create: `tests/core/skills/__fixtures__/skills/good/sf-feature/{body.md,manifest.js}`
- Create: `tests/core/skills/__fixtures__/skills/good/spec-review/{body.md,manifest.js}`
- Create: `tests/core/skills/__fixtures__/skills/mismatch/sf-feature/{body.md,manifest.js}`
- Create: `tests/core/skills/__fixtures__/skills/missing-body/sf-feature/{manifest.js}`

The loader walks `<packageRoot>/skills/<id>/`, dynamically imports the compiled manifest from a mirrored `<manifestsRoot>/skills/<id>/manifest.js`, reads `<packageRoot>/skills/<id>/body.md`, asserts manifest id matches folder name, and returns `SkillBundle[]`. Tests use fixture directories with hand-written JS files so they don't depend on the build step.

- [ ] **Step 1: Create test fixtures**

Write `tests/core/skills/__fixtures__/skills/good/sf-feature/body.md`:

```markdown
# sf-feature

stub body
```

Write `tests/core/skills/__fixtures__/skills/good/sf-feature/manifest.js`:

```js
export const manifest = {
  id: "sf-feature",
  kind: "user",
  description: "Start grilling session for a new feature.",
  argumentHint: "[title]",
  allowedTools: ["Read", "Write"],
  disableModelInvocation: true,
};
```

Write `tests/core/skills/__fixtures__/skills/good/spec-review/body.md`:

```markdown
# spec-review

stub body
```

Write `tests/core/skills/__fixtures__/skills/good/spec-review/manifest.js`:

```js
export const manifest = {
  id: "spec-review",
  kind: "subagent",
  description: "Critic pass on a spec.",
};
```

Write `tests/core/skills/__fixtures__/skills/mismatch/sf-feature/body.md`:

```markdown
# mismatch
```

Write `tests/core/skills/__fixtures__/skills/mismatch/sf-feature/manifest.js`:

```js
export const manifest = {
  id: "different-id",
  kind: "user",
  description: "Mismatched id.",
};
```

Write `tests/core/skills/__fixtures__/skills/missing-body/sf-feature/manifest.js`:

```js
export const manifest = {
  id: "sf-feature",
  kind: "user",
  description: "Missing body.",
};
```

- [ ] **Step 2: Write the failing tests**

Write `tests/core/skills/catalog.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/core/skills/catalog.test.ts`
Expected: FAIL — module `catalog.js` does not exist.

- [ ] **Step 4: Implement the loader**

Write `src/core/skills/catalog.ts`:

```ts
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SkillBundle, SkillManifest } from "./types.js";

export interface LoadCatalogOptions {
  readonly bodiesRoot: string;
  readonly manifestsRoot: string;
}

export async function loadCatalog(
  options: LoadCatalogOptions,
): Promise<SkillBundle[]> {
  const entries = await readdir(options.bodiesRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const seenIds = new Set<string>();
  const bundles: SkillBundle[] = [];

  for (const folder of directories) {
    const manifest = await loadManifest(
      join(options.manifestsRoot, folder, "manifest.js"),
    );

    if (manifest.id !== folder) {
      throw new Error(
        `manifest.id "${manifest.id}" does not match folder "${folder}"`,
      );
    }

    if (seenIds.has(manifest.id)) {
      throw new Error(`Duplicate skill id "${manifest.id}"`);
    }

    seenIds.add(manifest.id);

    const bodyPath = join(options.bodiesRoot, folder, "body.md");
    await assertFileExists(bodyPath);
    const body = await readFile(bodyPath, { encoding: "utf8" });

    bundles.push({ manifest, body });
  }

  return bundles;
}

async function loadManifest(modulePath: string): Promise<SkillManifest> {
  await assertFileExists(modulePath);
  const moduleUrl = pathToFileURL(modulePath).href;
  const imported = (await import(moduleUrl)) as { manifest?: unknown };

  if (
    imported.manifest === undefined ||
    typeof imported.manifest !== "object" ||
    imported.manifest === null
  ) {
    throw new Error(`manifest export missing from ${modulePath}`);
  }

  return imported.manifest as SkillManifest;
}

async function assertFileExists(path: string): Promise<void> {
  await stat(path).catch((error: unknown) => {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error(`Missing file: ${path}`);
    }

    throw error;
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/skills/catalog.test.ts`
Expected: PASS for all three cases.

- [ ] **Step 6: Commit**

```bash
git add src/core/skills/catalog.ts tests/core/skills/catalog.test.ts tests/core/skills/__fixtures__
git commit -m "feat(skills): add catalog loader with id and body validation"
```

---

## Task 8: Author 10 stub skills

**Files:**
- Create: `skills/sf-feature/{body.md, manifest.ts}`
- Create: `skills/sf-plan/{body.md, manifest.ts}`
- Create: `skills/sf-fix/{body.md, manifest.ts}`
- Create: `skills/sf-bug/{body.md, manifest.ts}`
- Create: `skills/sf-implement/{body.md, manifest.ts}`
- Create: `skills/spec-review/{body.md, manifest.ts}`
- Create: `skills/plan-review/{body.md, manifest.ts}`
- Create: `skills/code-review/{body.md, manifest.ts}`
- Create: `skills/verification/{body.md, manifest.ts}`
- Create: `skills/tdd/{body.md, manifest.ts}`
- Create: `tests/core/skills/bundled-catalog.test.ts`

Each body.md is a stub. Real prompt content is out of scope (follow-up specs).

- [ ] **Step 1: Author the five user skills**

For each id in `["sf-feature", "sf-plan", "sf-fix", "sf-bug", "sf-implement"]`, create the pair below. The `description` and `argumentHint` values come from the spec catalog table.

Write `skills/sf-feature/body.md`:

```markdown
# sf-feature

TODO: prompt content in follow-up spec.
```

Write `skills/sf-feature/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-feature",
  kind: "user",
  description:
    "Start grilling session for new feature. Reads ARCHITECTURE.md. Asks to update it when work touches structure. Writes spec.md.",
  argumentHint: "[title]",
  disableModelInvocation: true,
};
```

Write `skills/sf-plan/body.md`:

```markdown
# sf-plan

TODO: prompt content in follow-up spec.
```

Write `skills/sf-plan/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-plan",
  kind: "user",
  description:
    "Deep technical planning from approved spec.md. Writes design.md + tasks/. Reads ARCHITECTURE.md, asks to update if needed.",
  argumentHint: "[spec-id]",
  disableModelInvocation: true,
};
```

Write `skills/sf-fix/body.md`:

```markdown
# sf-fix

TODO: prompt content in follow-up spec.
```

Write `skills/sf-fix/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-fix",
  kind: "user",
  description: "Open a fix for an existing spec/task.",
  argumentHint: "[task-ref]",
  disableModelInvocation: true,
};
```

Write `skills/sf-bug/body.md`:

```markdown
# sf-bug

TODO: prompt content in follow-up spec.
```

Write `skills/sf-bug/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-bug",
  kind: "user",
  description: "Create a bug report. Standalone or spec-nested via --task.",
  argumentHint: "[description]",
  disableModelInvocation: true,
};
```

Write `skills/sf-implement/body.md`:

```markdown
# sf-implement

TODO: prompt content in follow-up spec.
```

Write `skills/sf-implement/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-implement",
  kind: "user",
  description:
    "Execute tasks from a plan. Prefers dispatching a subagent per task. Orchestrates.",
  argumentHint: "[spec-id]",
  disableModelInvocation: true,
};
```

- [ ] **Step 2: Author the five subagent skills**

Write `skills/spec-review/body.md`:

```markdown
# spec-review

TODO: prompt content in follow-up spec.
```

Write `skills/spec-review/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "spec-review",
  kind: "subagent",
  description:
    "Critic pass on a spec.md. Surfaces ambiguity, missing AC, CONTEXT.md gaps.",
};
```

Write `skills/plan-review/body.md`:

```markdown
# plan-review

TODO: prompt content in follow-up spec.
```

Write `skills/plan-review/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "plan-review",
  kind: "subagent",
  description:
    "Critic pass on design.md + tasks/. Checks plan vs ARCHITECTURE.md.",
};
```

Write `skills/code-review/body.md`:

```markdown
# code-review

TODO: prompt content in follow-up spec.
```

Write `skills/code-review/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "code-review",
  kind: "subagent",
  description:
    "Quality review of changes against ARCHITECTURE.md and AGENTS.md rules.",
};
```

Write `skills/verification/body.md`:

```markdown
# verification

TODO: prompt content in follow-up spec.
```

Write `skills/verification/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "verification",
  kind: "subagent",
  description:
    "Verify implementation matches spec + plan. Runs user validations from EVALUATION.md.",
};
```

Write `skills/tdd/body.md`:

```markdown
# tdd

TODO: prompt content in follow-up spec.
```

Write `skills/tdd/manifest.ts`:

```ts
import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "tdd",
  kind: "subagent",
  description:
    "Enforce tests-first discipline. Writes failing test before implementation per task.",
};
```

- [ ] **Step 3: Build so compiled manifests exist**

Run: `npm run build`
Expected: PASS. `dist/skills/sf-feature/manifest.js` and the other nine exist.

Run: `ls dist/skills`
Expected: 10 directories listed.

- [ ] **Step 4: Write the bundled-catalog test**

Write `tests/core/skills/bundled-catalog.test.ts`:

```ts
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
      "code-review",
      "plan-review",
      "sf-bug",
      "sf-feature",
      "sf-fix",
      "sf-implement",
      "sf-plan",
      "spec-review",
      "tdd",
      "verification",
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
      "code-review",
      "plan-review",
      "spec-review",
      "tdd",
      "verification",
    ]);
  });
});
```

- [ ] **Step 5: Run the bundled-catalog test**

Run: `npx vitest run tests/core/skills/bundled-catalog.test.ts`
Expected: PASS — 10 entries, correct partition.

- [ ] **Step 6: Commit**

```bash
git add skills/ tests/core/skills/bundled-catalog.test.ts
git commit -m "feat(skills): bundle 10 stub skills (sf-* + reviews + tdd + verification)"
```

---

## Task 9: Scaffold doc replacement

**Files:**
- Modify: `src/core/init/scaffold.ts`
- Modify: `tests/core/init/scaffold.test.ts`

Replace `TESTING.md` with `EVALUATION.md`; add `ARCHITECTURE.md` and `CONTEXT.md` to the bootstrap document list.

- [ ] **Step 1: Update the scaffold test for the new docs**

Replace the contents of `tests/core/init/scaffold.test.ts` with:

```ts
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldInit } from "../../../src/core/init/scaffold.js";

describe("scaffoldInit", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map(async (directory) => {
        const { rm } = await import("node:fs/promises");
        await rm(directory, { force: true, recursive: true });
      }),
    );
    temporaryDirectories.length = 0;
  });

  it("creates the base specflow directories and bootstrap docs", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await scaffoldInit({ projectRoot });

    await expectDirectory(join(projectRoot, "docs", "specflow", ".specflow"));
    await expectDirectory(join(projectRoot, "docs", "specflow", "specs"));
    await expectDirectory(join(projectRoot, "docs", "specflow", "bugs"));

    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "EVALUATION.md"), "utf8"),
    ).toBe(expectedEvaluationDocument);
    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "ROADMAP.md"), "utf8"),
    ).toBe(expectedRoadmapDocument);
    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "ARCHITECTURE.md"), "utf8"),
    ).toBe(expectedArchitectureDocument);
    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "CONTEXT.md"), "utf8"),
    ).toBe(expectedContextDocument);

    await expect(
      access(join(projectRoot, "docs", "specflow", "TESTING.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves existing docs when rerun", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow"), { recursive: true });
    writeFileSync(
      join(projectRoot, "docs", "specflow", "EVALUATION.md"),
      "# Existing evaluation\nDo not replace.\n",
      "utf8",
    );
    writeFileSync(
      join(projectRoot, "docs", "specflow", "ROADMAP.md"),
      "# Existing roadmap\nKeep this plan.\n",
      "utf8",
    );
    writeFileSync(
      join(projectRoot, "docs", "specflow", "ARCHITECTURE.md"),
      "# Existing architecture\n",
      "utf8",
    );
    writeFileSync(
      join(projectRoot, "docs", "specflow", "CONTEXT.md"),
      "# Existing context\n",
      "utf8",
    );

    await scaffoldInit({ projectRoot });

    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "EVALUATION.md"), "utf8"),
    ).toBe("# Existing evaluation\nDo not replace.\n");
    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "ROADMAP.md"), "utf8"),
    ).toBe("# Existing roadmap\nKeep this plan.\n");
    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "ARCHITECTURE.md"), "utf8"),
    ).toBe("# Existing architecture\n");
    expect(
      readFileSync(join(projectRoot, "docs", "specflow", "CONTEXT.md"), "utf8"),
    ).toBe("# Existing context\n");
  });

  it("fails when a doc path already exists as a directory", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow", "EVALUATION.md"), {
      recursive: true,
    });

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, "docs", "specflow", "EVALUATION.md")}: path exists and is not a regular file.`,
    });
  });

  it("does not create bootstrap directories when a doc path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow", "ROADMAP.md"), {
      recursive: true,
    });

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold bootstrap document at ${join(projectRoot, "docs", "specflow", "ROADMAP.md")}: path exists and is not a regular file.`,
    });

    await expect(
      access(join(projectRoot, "docs", "specflow", ".specflow")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails without partial writes when a scaffold directory path conflicts", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-init-core-"));
    temporaryDirectories.push(projectRoot);

    await mkdir(join(projectRoot, "docs", "specflow"), { recursive: true });
    writeFileSync(
      join(projectRoot, "docs", "specflow", "specs"),
      "conflict",
      "utf8",
    );

    await expect(scaffoldInit({ projectRoot })).rejects.toMatchObject({
      message: `Cannot scaffold directory at ${join(projectRoot, "docs", "specflow", "specs")}: path exists and is not a directory.`,
    });

    const conflictingEntry = await stat(
      join(projectRoot, "docs", "specflow", "specs"),
    );
    expect(conflictingEntry.isFile()).toBe(true);
    await expect(
      access(join(projectRoot, "docs", "specflow", "EVALUATION.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

const expectedEvaluationDocument = `# EVALUATION.md

Evaluation is a release gate for this repository.

## Required Checks

- Run targeted tests for the module you changed.
- Add filesystem-level coverage for scaffolding and generated output.
- Verify command behavior end to end once CLI wiring exists.

## Verification Notes

- Prefer deterministic tests over mocks for file generation.
- Inspect generated files for meaningful content, not only existence.
- Record any skipped verification so the gap is explicit.
`;

const expectedRoadmapDocument = `# ROADMAP.md

## Milestones

1. Define the workflows and templates this repository needs.
2. Implement core logic with reusable modules and test coverage.
3. Add CLI commands that exercise the core behavior safely.

## Near-Term Focus

- Keep generated project conventions clear and easy to maintain.
- Expand verification as more commands become user-facing.
- Use this roadmap to track the next approved increments.
`;

const expectedArchitectureDocument = `# ARCHITECTURE.md

> Read this before starting any spec or plan session.
> Update this when structural decisions are made during grilling or planning.

## System Overview

<!-- One paragraph. What does this system do and for whom. -->

## Services and Boundaries

<!-- List services, what they own, what they do NOT own. -->

## Communication Patterns

<!-- REST, events, queues, shared DB — what is allowed and what is banned. -->

## Persistence

<!-- Databases, stores, cache layers. Who owns what data. -->

## Tech Stack

<!-- Language, frameworks, runtimes, infra. -->

## Constraints

<!-- Hard limits: latency budgets, data residency, security requirements. -->

## Open Decisions

<!-- Things not yet resolved. Remove when resolved; move to relevant section above. -->
`;

const expectedContextDocument = `# CONTEXT.md

> Project glossary. Every term used in specs must be defined here.
> If a term is missing during a spec session, define it and update this file.

## Terms

<!-- Template:
### TermName
**Definition:** One clear sentence.
**Distinct from:** Other terms it might be confused with.
**Used in:** Links to specs or architecture sections where it appears.
-->
`;

async function expectDirectory(directoryPath: string): Promise<void> {
  await access(directoryPath);
  const directoryEntry = await stat(directoryPath);

  expect(directoryEntry.isDirectory()).toBe(true);
}
```

- [ ] **Step 2: Run scaffold tests to verify they fail**

Run: `npx vitest run tests/core/init/scaffold.test.ts`
Expected: FAIL — current scaffold still writes `TESTING.md` and does not write the new docs.

- [ ] **Step 3: Update `src/core/init/scaffold.ts`**

Replace the body of the existing helper functions and `buildBootstrapDocuments`:

```ts
function buildBootstrapDocuments(specsRoot: string): BootstrapDocument[] {
  return [
    {
      path: join(specsRoot, "EVALUATION.md"),
      contents: buildEvaluationDocument(),
    },
    {
      path: join(specsRoot, "ROADMAP.md"),
      contents: buildRoadmapDocument(),
    },
    {
      path: join(specsRoot, "ARCHITECTURE.md"),
      contents: buildArchitectureDocument(),
    },
    {
      path: join(specsRoot, "CONTEXT.md"),
      contents: buildContextDocument(),
    },
  ];
}
```

Replace `buildTestingDocument` with `buildEvaluationDocument`:

```ts
function buildEvaluationDocument(): string {
  return `# EVALUATION.md

Evaluation is a release gate for this repository.

## Required Checks

- Run targeted tests for the module you changed.
- Add filesystem-level coverage for scaffolding and generated output.
- Verify command behavior end to end once CLI wiring exists.

## Verification Notes

- Prefer deterministic tests over mocks for file generation.
- Inspect generated files for meaningful content, not only existence.
- Record any skipped verification so the gap is explicit.
`;
}
```

Add `buildArchitectureDocument` and `buildContextDocument` next to `buildRoadmapDocument`:

```ts
function buildArchitectureDocument(): string {
  return `# ARCHITECTURE.md

> Read this before starting any spec or plan session.
> Update this when structural decisions are made during grilling or planning.

## System Overview

<!-- One paragraph. What does this system do and for whom. -->

## Services and Boundaries

<!-- List services, what they own, what they do NOT own. -->

## Communication Patterns

<!-- REST, events, queues, shared DB — what is allowed and what is banned. -->

## Persistence

<!-- Databases, stores, cache layers. Who owns what data. -->

## Tech Stack

<!-- Language, frameworks, runtimes, infra. -->

## Constraints

<!-- Hard limits: latency budgets, data residency, security requirements. -->

## Open Decisions

<!-- Things not yet resolved. Remove when resolved; move to relevant section above. -->
`;
}

function buildContextDocument(): string {
  return `# CONTEXT.md

> Project glossary. Every term used in specs must be defined here.
> If a term is missing during a spec session, define it and update this file.

## Terms

<!-- Template:
### TermName
**Definition:** One clear sentence.
**Distinct from:** Other terms it might be confused with.
**Used in:** Links to specs or architecture sections where it appears.
-->
`;
}
```

Delete the now-unused `buildTestingDocument` function. The dead `buildAgentsDocument` stays as-is (out of scope per the spec).

- [ ] **Step 4: Run scaffold tests to verify they pass**

Run: `npx vitest run tests/core/init/scaffold.test.ts`
Expected: PASS for all five tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/init/scaffold.ts tests/core/init/scaffold.test.ts
git commit -m "feat(init): replace TESTING with EVALUATION; add ARCHITECTURE and CONTEXT docs"
```

---

## Task 10: Config writer

**Files:**
- Create: `src/core/init/config.ts`
- Create: `tests/core/init/config.test.ts`

`.specflow/config.json` records the chosen harness.

- [ ] **Step 1: Write the failing tests**

Write `tests/core/init/config.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeConfig } from "../../../src/core/init/config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

describe("writeConfig", () => {
  it("writes config.json with the chosen harness", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-config-"));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, "docs", "specflow", ".specflow"), {
      recursive: true,
    });

    await writeConfig({ projectRoot, harness: "claude-code" });

    const written = JSON.parse(
      readFileSync(
        join(projectRoot, "docs", "specflow", ".specflow", "config.json"),
        "utf8",
      ),
    );

    expect(written).toEqual({ version: 1, harness: "claude-code" });
  });

  it("preserves existing config.json on rerun", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-config-"));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, "docs", "specflow", ".specflow"), {
      recursive: true,
    });
    const { writeFile } = await import("node:fs/promises");
    const configPath = join(
      projectRoot,
      "docs",
      "specflow",
      ".specflow",
      "config.json",
    );
    await writeFile(configPath, '{"version":1,"harness":"opencode"}', "utf8");

    await writeConfig({ projectRoot, harness: "claude-code" });

    expect(readFileSync(configPath, "utf8")).toBe(
      '{"version":1,"harness":"opencode"}',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/init/config.test.ts`
Expected: FAIL — module `config.js` does not exist.

- [ ] **Step 3: Implement the writer**

Write `src/core/init/config.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessId } from "../skills/harness/adapter.js";

export interface WriteConfigOptions {
  readonly projectRoot: string;
  readonly harness: HarnessId;
}

export async function writeConfig(options: WriteConfigOptions): Promise<void> {
  const configPath = join(
    options.projectRoot,
    "docs",
    "specflow",
    ".specflow",
    "config.json",
  );

  const document = JSON.stringify({ version: 1, harness: options.harness });

  await writeFile(configPath, document, {
    encoding: "utf8",
    flag: "wx",
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EEXIST"
    ) {
      return;
    }

    throw error;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/init/config.test.ts`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/init/config.ts tests/core/init/config.test.ts
git commit -m "feat(init): write .specflow/config.json with chosen harness"
```

---

## Task 11: Harness prompt

**Files:**
- Create: `src/core/init/prompt-harness.ts`
- Create: `tests/core/init/prompt-harness.test.ts`

`resolveHarness` accepts `{ flag, yes, ask }`. `ask` is an injectable async function so tests don't touch stdin.

- [ ] **Step 1: Write the failing tests**

Write `tests/core/init/prompt-harness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InvalidHarnessError } from "../../../src/core/skills/harness/adapter.js";
import { resolveHarness } from "../../../src/core/init/prompt-harness.js";

describe("resolveHarness", () => {
  it("returns the validated flag value when provided", async () => {
    const harness = await resolveHarness({
      flag: "claude-code",
      yes: false,
      ask: async () => {
        throw new Error("ask should not be called when a flag is provided");
      },
    });

    expect(harness).toBe("claude-code");
  });

  it("throws InvalidHarnessError on an unknown flag value", async () => {
    await expect(
      resolveHarness({
        flag: "nope",
        yes: false,
        ask: async () => "claude-code",
      }),
    ).rejects.toThrowError(InvalidHarnessError);
  });

  it("defaults to claude-code when --yes is set and no flag", async () => {
    const harness = await resolveHarness({
      flag: undefined,
      yes: true,
      ask: async () => {
        throw new Error("ask should not be called when --yes is set");
      },
    });

    expect(harness).toBe("claude-code");
  });

  it("calls ask with all known harness ids and returns the picked one", async () => {
    let received: readonly string[] | undefined;

    const harness = await resolveHarness({
      flag: undefined,
      yes: false,
      ask: async (choices) => {
        received = choices;
        return "opencode";
      },
    });

    expect(received).toEqual([
      "claude-code",
      "opencode",
      "codex",
      "cursor",
      "agents-md",
    ]);
    expect(harness).toBe("opencode");
  });

  it("throws InvalidHarnessError when ask returns an unknown id", async () => {
    await expect(
      resolveHarness({
        flag: undefined,
        yes: false,
        ask: async () => "nope",
      }),
    ).rejects.toThrowError(InvalidHarnessError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/init/prompt-harness.test.ts`
Expected: FAIL — module `prompt-harness.js` does not exist.

- [ ] **Step 3: Implement the resolver**

Write `src/core/init/prompt-harness.ts`:

```ts
import {
  InvalidHarnessError,
  KNOWN_HARNESS_IDS,
  isHarnessId,
  type HarnessId,
} from "../skills/harness/adapter.js";

export type HarnessAsk = (choices: readonly HarnessId[]) => Promise<string>;

export interface ResolveHarnessOptions {
  readonly flag: string | undefined;
  readonly yes: boolean;
  readonly ask: HarnessAsk;
}

const DEFAULT_HARNESS: HarnessId = "claude-code";

export async function resolveHarness(
  options: ResolveHarnessOptions,
): Promise<HarnessId> {
  if (options.flag !== undefined) {
    return validate(options.flag);
  }

  if (options.yes) {
    return DEFAULT_HARNESS;
  }

  const picked = await options.ask(KNOWN_HARNESS_IDS);
  return validate(picked);
}

function validate(value: string): HarnessId {
  if (!isHarnessId(value)) {
    throw new InvalidHarnessError(value);
  }

  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/init/prompt-harness.test.ts`
Expected: PASS — all five cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/init/prompt-harness.ts tests/core/init/prompt-harness.test.ts
git commit -m "feat(init): add harness resolver with flag, yes, and injectable ask"
```

---

## Task 12: Install-skills orchestrator

**Files:**
- Create: `src/core/init/install-skills.ts`
- Create: `tests/core/init/install-skills.test.ts`

`installSkills` loads the catalog and hands it to the chosen adapter. The package root resolves from `import.meta.url` at the call site; tests inject an explicit `packageRoot`.

- [ ] **Step 1: Write the failing tests**

Write `tests/core/init/install-skills.test.ts`:

```ts
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { installSkills } from "../../../src/core/init/install-skills.js";
import { HarnessNotImplementedError } from "../../../src/core/skills/harness/adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..", "..", "..");

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
  temporaryDirectories.length = 0;
});

describe("installSkills", () => {
  it("installs all 10 bundled skills to the claude-code targets", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-install-"));
    temporaryDirectories.push(projectRoot);

    await installSkills({
      projectRoot,
      harness: "claude-code",
      packageRoot,
    });

    for (const id of [
      "sf-feature",
      "sf-plan",
      "sf-fix",
      "sf-bug",
      "sf-implement",
    ]) {
      expect(
        existsSync(join(projectRoot, ".claude", "skills", id, "SKILL.md")),
      ).toBe(true);
    }

    for (const id of [
      "spec-review",
      "plan-review",
      "code-review",
      "verification",
      "tdd",
    ]) {
      expect(
        existsSync(join(projectRoot, ".claude", "agents", `${id}.md`)),
      ).toBe(true);
    }
  });

  it("throws HarnessNotImplementedError for opencode without writing anything", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "specflow-install-"));
    temporaryDirectories.push(projectRoot);

    await expect(
      installSkills({ projectRoot, harness: "opencode", packageRoot }),
    ).rejects.toThrowError(HarnessNotImplementedError);

    expect(existsSync(join(projectRoot, ".claude"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/init/install-skills.test.ts`
Expected: FAIL — module `install-skills.js` does not exist.

- [ ] **Step 3: Implement the orchestrator**

Write `src/core/init/install-skills.ts`:

```ts
import { join } from "node:path";
import { loadCatalog } from "../skills/catalog.js";
import "../skills/harness/register-defaults.js";
import type { HarnessId } from "../skills/harness/adapter.js";
import { getAdapter } from "../skills/harness/registry.js";

export interface InstallSkillsOptions {
  readonly projectRoot: string;
  readonly harness: HarnessId;
  readonly packageRoot: string;
}

export async function installSkills(
  options: InstallSkillsOptions,
): Promise<void> {
  const adapter = getAdapter(options.harness);
  const bundles = await loadCatalog({
    bodiesRoot: join(options.packageRoot, "skills"),
    manifestsRoot: join(options.packageRoot, "dist", "skills"),
  });

  await adapter.install(bundles, options.projectRoot);
}
```

The side-effecting `register-defaults` import runs once at module load and registers `claudeCodeAdapter` in the registry. The `getAdapter` call then resolves it (or throws for harnesses that have no adapter).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/init/install-skills.test.ts`
Expected: PASS for both cases.

- [ ] **Step 5: Commit**

```bash
git add src/core/init/install-skills.ts tests/core/init/install-skills.test.ts
git commit -m "feat(init): orchestrate skill install via catalog + harness adapter"
```

---

## Task 13: Wire `--harness` / `--yes` into the CLI

**Files:**
- Modify: `src/core/init/types.ts`
- Modify: `src/cli/commands/init.ts`

The CLI parses flags, builds an interactive `ask` from `node:readline/promises`, resolves the harness, calls the existing scaffolder, installs skills, writes the config.

- [ ] **Step 1: Update `InitOptions`**

Replace `src/core/init/types.ts`:

```ts
import type { HarnessId } from "../skills/harness/adapter.js";

export interface InitOptions {
  readonly projectRoot: string;
  readonly harness?: HarnessId;
}
```

(`scaffoldInit` already accepts `InitOptions`; the new optional field is unused inside the existing function but available to other callers.)

- [ ] **Step 2: Rewrite `src/cli/commands/init.ts`**

Replace the file contents:

```ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cwd, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { scaffoldInit } from "../../core/init/scaffold.js";
import { resolveHarness } from "../../core/init/prompt-harness.js";
import { installSkills } from "../../core/init/install-skills.js";
import { writeConfig } from "../../core/init/config.js";
import type { HarnessId } from "../../core/skills/harness/adapter.js";

interface InitCommandOptions {
  readonly harness?: string;
  readonly yes?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize specflow in the current repository")
    .option("--harness <id>", "harness adapter to install skills for")
    .option("--yes", "skip prompts and use defaults")
    .action(async (options: InitCommandOptions) => {
      const projectRoot = cwd();
      const packageRoot = resolvePackageRoot();
      const harness = await resolveHarness({
        flag: options.harness,
        yes: options.yes === true,
        ask: askInteractively,
      });

      await scaffoldInit({ projectRoot, harness });
      await installSkills({ projectRoot, harness, packageRoot });
      await writeConfig({ projectRoot, harness });
    });
}

async function askInteractively(
  choices: readonly HarnessId[],
): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const numbered = choices
      .map((id, index) => `  ${index + 1}) ${id}`)
      .join("\n");
    const prompt = `Pick a harness:\n${numbered}\nEnter number (default 1): `;
    const answer = (await rl.question(prompt)).trim();

    if (answer === "") {
      const first = choices[0];
      if (first === undefined) {
        throw new Error("No harness choices available");
      }
      return first;
    }

    const index = Number.parseInt(answer, 10) - 1;
    const picked = choices[index];

    if (picked === undefined) {
      return answer;
    }

    return picked;
  } finally {
    rl.close();
  }
}

function resolvePackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}
```

- [ ] **Step 3: Typecheck and run the whole unit suite**

Run: `npm run typecheck`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS for all unit tests added in Tasks 4–12 plus the existing suite.

- [ ] **Step 4: Commit**

```bash
git add src/core/init/types.ts src/cli/commands/init.ts
git commit -m "feat(cli): wire --harness and --yes through init"
```

---

## Task 14: Installed-build end-to-end coverage

**Files:**
- Modify: `tests/e2e/installed-init.test.ts`

Update the existing installed-build tests for the new docs and add coverage for `--harness claude-code` and the not-implemented case. The helper at `tests/e2e/installed-test-helpers.ts` already builds and packs the package — the `dist/skills/` directory and bundled `skills/` will be included via the updated `package.json` `files[]`.

- [ ] **Step 1: Inspect the helper to confirm the install path**

Run: `cat tests/e2e/installed-test-helpers.ts`
Expected: helper runs `npm pack` and installs into a temp dir. Confirm `runInstalledInit` accepts an `args: string[]` parameter or a working directory only — adapt the Step 2 edits to match. If the existing signature is `runInstalledInit(dir: string)` with no extra args, extend it to `runInstalledInit(dir: string, args: readonly string[] = [])` in the helper and pass `args` to the spawned process.

- [ ] **Step 2: Update `tests/e2e/installed-init.test.ts`**

Replace the existing expected document constants and assertions. Apply these edits:

1. Replace the imports and the `expectedTestingDocument` / `preservedTestingDocument` constants with `expectedEvaluationDocument` and `preservedEvaluationDocument` (mirror the Task 9 strings).
2. In the first test, replace the `TESTING.md` read with an `EVALUATION.md` read and add reads for `ARCHITECTURE.md` and `CONTEXT.md`.
3. Pass `["--harness", "claude-code"]` to `runInstalledInit` in the first test.
4. After the doc assertions, assert:

```ts
expect(
  existsSync(
    join(
      installation.installDirectory,
      ".claude",
      "skills",
      "sf-feature",
      "SKILL.md",
    ),
  ),
).toBe(true);
expect(
  existsSync(
    join(installation.installDirectory, ".claude", "agents", "code-review.md"),
  ),
).toBe(true);

const config = JSON.parse(
  readFileSync(
    join(
      installation.installDirectory,
      "docs",
      "specflow",
      ".specflow",
      "config.json",
    ),
    "utf8",
  ),
);
expect(config).toEqual({ version: 1, harness: "claude-code" });
```

5. In the rerun test, write a preserved `EVALUATION.md`, `ARCHITECTURE.md`, `CONTEXT.md` instead of `TESTING.md`; pass `["--harness", "claude-code", "--yes"]` to both `runInstalledInit` calls.
6. In the conflict test, point the conflict at `EVALUATION.md` instead of `TESTING.md`, expect the corresponding error message, and assert `.claude/` is not created.

- [ ] **Step 3: Add the not-implemented case**

Append a new test to the `describe` block:

```ts
it("returns a stable non-zero exit when the chosen harness is not implemented", () => {
  const installation = createInstalledPackageTestEnvironment("installed-init-");

  try {
    const result = runInstalledInit(installation.installDirectory, [
      "--harness",
      "opencode",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("opencode");
    expect(result.stderr).toContain("not implemented");
    expect(existsSync(join(installation.installDirectory, ".claude"))).toBe(
      false,
    );
    expect(
      existsSync(
        join(installation.installDirectory, "docs", "specflow", "EVALUATION.md"),
      ),
    ).toBe(false);
  } finally {
    cleanupInstalledPackageTestEnvironment(installation);
  }
});
```

- [ ] **Step 4: Run the installed-build suite**

Run: `npx vitest run tests/e2e/installed-init.test.ts`
Expected: PASS for all updated cases.

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: PASS overall.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/installed-init.test.ts tests/e2e/installed-test-helpers.ts
git commit -m "test(e2e): cover --harness claude-code install and not-implemented exit"
```

---

## Final verification

- [ ] **Step 1: Run the full suite one more time**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify the package contents**

Run: `npm pack --dry-run 2>&1 | grep -E "skills/|dist/skills/"`
Expected: Lines for `skills/sf-feature/body.md`, `skills/sf-feature/manifest.ts`, `dist/skills/sf-feature/manifest.js`, and the other nine ids appear.
