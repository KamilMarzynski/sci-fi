import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { InitOptions } from "./types.js";

type BootstrapDocument = {
  path: string;
  contents: string;
};

type ScaffoldDirectory = {
  path: string;
};

/**
 * Create the baseline specflow directories and bootstrap documents.
 */
export async function scaffoldInit(options: InitOptions): Promise<void> {
  const { projectRoot } = options;
  const specsRoot = join(projectRoot, 'docs', 'specflow');
  const scaffoldDirectories = buildScaffoldDirectories(specsRoot);
  const bootstrapDocuments = buildBootstrapDocuments(specsRoot);

  await validateScaffoldDirectoryPaths(scaffoldDirectories);
  await validateBootstrapDocumentPaths(bootstrapDocuments);

  await Promise.all([
    ...scaffoldDirectories.map((directory) =>
      mkdir(directory.path, { recursive: true }),
    ),
  ]);

  await Promise.all(
    bootstrapDocuments.map((document) =>
      writeBootstrapDocument(document.path, document.contents),
    ),
  );
}

function buildScaffoldDirectories(specsRoot: string): ScaffoldDirectory[] {
  return [
    { path: join(specsRoot, ".specflow") },
    { path: join(specsRoot, "specs") },
    { path: join(specsRoot, "bugs") },
  ];
}

function buildBootstrapDocuments(specsRoot: string): BootstrapDocument[] {
  return [
    {
      path: join(specsRoot, "TESTING.md"),
      contents: buildTestingDocument(),
    },
    {
      path: join(specsRoot, "ROADMAP.md"),
      contents: buildRoadmapDocument(),
    },
  ];
}

async function validateScaffoldDirectoryPaths(
  scaffoldDirectories: readonly ScaffoldDirectory[],
): Promise<void> {
  await Promise.all(
    scaffoldDirectories.map(async (directory) => {
      const existingEntry = await stat(directory.path).catch(
        (error: unknown): null => {
          if (isMissingPathError(error)) {
            return null;
          }

          throw error;
        },
      );

      if (existingEntry === null || existingEntry.isDirectory()) {
        return;
      }

      throw new Error(
        `Cannot scaffold directory at ${directory.path}: path exists and is not a directory.`,
      );
    }),
  );
}

async function validateBootstrapDocumentPaths(
  bootstrapDocuments: readonly BootstrapDocument[],
): Promise<void> {
  await Promise.all(
    bootstrapDocuments.map(async (document) => {
      const existingEntry = await stat(document.path).catch(
        (error: unknown): null => {
          if (isMissingPathError(error)) {
            return null;
          }

          throw error;
        },
      );

      if (existingEntry === null || existingEntry.isFile()) {
        return;
      }

      throw new Error(
        `Cannot scaffold bootstrap document at ${document.path}: path exists and is not a regular file.`,
      );
    }),
  );
}

async function writeBootstrapDocument(
  filePath: string,
  contents: string,
): Promise<void> {
  await writeFile(filePath, contents, { encoding: "utf8", flag: "wx" }).catch(
    async (error: unknown) => {
      if (isPathAlreadyPresentError(error)) {
        const existingEntry = await stat(filePath);

        if (existingEntry.isFile()) {
          return;
        }

        throw new Error(
          `Cannot scaffold bootstrap document at ${filePath}: path exists and is not a regular file.`,
          { cause: error },
        );
      }

      throw error;
    },
  );
}

function isPathAlreadyPresentError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function buildAgentsDocument(): string {
  return `# AGENTS.md

This repository uses \`specflow\` to keep implementation work aligned with written specs.

## Workflow Expectations

- Capture specflow-managed feature work in \`docs/specflow/specs/\` before implementing.
- Track production bugs in \`bugs/\` with reproduction details and fix status.
- Keep command wiring thin and move reusable logic into core modules.

## Collaboration Rules

- Treat generated docs as working agreements, not placeholders.
- Update specs and bug notes when behavior changes.
- Verify meaningful changes with automated checks before handing work off.
`;
}

function buildTestingDocument(): string {
  return `# TESTING.md

Testing is a release gate for this repository.

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

function buildRoadmapDocument(): string {
  return `# ROADMAP.md

## Milestones

1. Define the workflows and templates this repository needs.
2. Implement core logic with reusable modules and test coverage.
3. Add CLI commands that exercise the core behavior safely.

## Near-Term Focus

- Keep generated project conventions clear and easy to maintain.
- Expand verification as more commands become user-facing.
- Use this roadmap to track the next approved increments.
`;
}
