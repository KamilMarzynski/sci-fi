import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InitOptions } from './types.js';

type BootstrapDocument = {
  path: string;
  contents: string;
};

type ScaffoldDirectory = {
  path: string;
};

/**
 * Create the baseline scifi directories and bootstrap documents.
 */
export async function scaffoldInit(options: InitOptions): Promise<void> {
  const { projectRoot } = options;
  const specsRoot = join(projectRoot, 'docs', 'scifi');
  const scaffoldDirectories = buildScaffoldDirectories(specsRoot);
  const bootstrapDocuments = buildBootstrapDocuments(specsRoot);

  await validateScaffoldDirectoryPaths(scaffoldDirectories);
  await validateBootstrapDocumentPaths(bootstrapDocuments);

  await Promise.all([
    ...scaffoldDirectories.map((directory) => mkdir(directory.path, { recursive: true })),
  ]);

  await Promise.all(
    bootstrapDocuments.map((document) => writeBootstrapDocument(document.path, document.contents)),
  );
}

function buildScaffoldDirectories(specsRoot: string): ScaffoldDirectory[] {
  return [
    { path: join(specsRoot, '.scifi') },
    { path: join(specsRoot, 'specs') },
    { path: join(specsRoot, 'bugs') },
  ];
}

function buildBootstrapDocuments(specsRoot: string): BootstrapDocument[] {
  return [
    {
      path: join(specsRoot, 'EVALUATION.md'),
      contents: buildEvaluationDocument(),
    },
    {
      path: join(specsRoot, 'ARCHITECTURE.md'),
      contents: buildArchitectureDocument(),
    },
    {
      path: join(specsRoot, 'CONTEXT.md'),
      contents: buildContextDocument(),
    },
  ];
}

async function validateScaffoldDirectoryPaths(
  scaffoldDirectories: readonly ScaffoldDirectory[],
): Promise<void> {
  await Promise.all(
    scaffoldDirectories.map(async (directory) => {
      const existingEntry = await stat(directory.path).catch((error: unknown): null => {
        if (isMissingPathError(error)) {
          return null;
        }

        throw error;
      });

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
      const existingEntry = await stat(document.path).catch((error: unknown): null => {
        if (isMissingPathError(error)) {
          return null;
        }

        throw error;
      });

      if (existingEntry === null || existingEntry.isFile()) {
        return;
      }

      throw new Error(
        `Cannot scaffold bootstrap document at ${document.path}: path exists and is not a regular file.`,
      );
    }),
  );
}

async function writeBootstrapDocument(filePath: string, contents: string): Promise<void> {
  await writeFile(filePath, contents, { encoding: 'utf8', flag: 'wx' }).catch(
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

function isPathAlreadyPresentError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

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
