import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledInit,
} from './installed-test-helpers.js';

describe('installed build init verification', () => {
  it('initializes the project structure from an installed package in the dedicated workspace', () => {
    const installation = createInstalledPackageTestEnvironment('installed-init-');

    try {
      const result = runInstalledInit(installation.installDirectory, ['--harness', 'claude-code']);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', '.scifi'))).toBe(true);
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', 'specs'))).toBe(true);
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', 'bugs'))).toBe(true);
      expect(
        readFileSync(join(installation.installDirectory, 'docs', 'scifi', 'EVALUATION.md'), 'utf8'),
      ).toBe(expectedEvaluationDocument);
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', 'ROADMAP.md'))).toBe(
        false,
      );

      expect(
        existsSync(
          join(installation.installDirectory, '.claude', 'skills', 'sf-feature', 'SKILL.md'),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(installation.installDirectory, '.claude', 'skills', 'sf-code-review', 'SKILL.md'),
        ),
      ).toBe(true);

      const config = JSON.parse(
        readFileSync(
          join(installation.installDirectory, 'docs', 'scifi', '.scifi', 'config.json'),
          'utf8',
        ),
      );
      expect(config).toEqual({ version: 1, harness: 'claude-code' });
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('allows a safe installed-build rerun without overwriting existing bootstrap docs or generated files', () => {
    const installation = createInstalledPackageTestEnvironment('installed-init-');

    try {
      const initialRun = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
        '--yes',
      ]);

      expect(initialRun.status).toBe(0);
      expect(initialRun.stderr).toBe('');

      const scifiRoot = join(installation.installDirectory, 'docs', 'scifi');
      const evaluationPath = join(scifiRoot, 'EVALUATION.md');
      const specPath = join(scifiRoot, 'specs', 'existing-spec.md');
      const bugPath = join(scifiRoot, 'bugs', 'existing-bug.md');
      const statePath = join(scifiRoot, '.scifi', 'state.json');
      const skillPath = join(
        installation.installDirectory,
        '.claude',
        'skills',
        'sf-feature',
        'SKILL.md',
      );
      const reviewSkillPath = join(
        installation.installDirectory,
        '.claude',
        'skills',
        'sf-code-review',
        'SKILL.md',
      );

      writeFileSync(evaluationPath, preservedEvaluationDocument, 'utf8');
      writeFileSync(specPath, preservedSpecDocument, 'utf8');
      writeFileSync(bugPath, preservedBugDocument, 'utf8');
      writeFileSync(statePath, preservedStateDocument, 'utf8');

      const skillBeforeRerun = readFileSync(skillPath, 'utf8');
      const reviewBeforeRerun = readFileSync(reviewSkillPath, 'utf8');
      writeFileSync(skillPath, 'user override\n', 'utf8');
      writeFileSync(reviewSkillPath, 'user override\n', 'utf8');

      const rerun = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
        '--yes',
      ]);

      expect(rerun.status).toBe(0);
      expect(rerun.stderr).toBe('');
      expect(readFileSync(evaluationPath, 'utf8')).toBe(preservedEvaluationDocument);
      expect(readFileSync(specPath, 'utf8')).toBe(preservedSpecDocument);
      expect(readFileSync(bugPath, 'utf8')).toBe(preservedBugDocument);
      expect(readFileSync(statePath, 'utf8')).toBe(preservedStateDocument);
      expect(existsSync(join(scifiRoot, '.scifi'))).toBe(true);
      expect(existsSync(join(scifiRoot, 'specs'))).toBe(true);
      expect(existsSync(join(scifiRoot, 'bugs'))).toBe(true);

      // Bundled sf-* skills are sci-fi-owned: rerun must overwrite
      // local edits back to the bundled content (documented in README).
      expect(readFileSync(skillPath, 'utf8')).toBe(skillBeforeRerun);
      expect(readFileSync(reviewSkillPath, 'utf8')).toBe(reviewBeforeRerun);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('returns a stable non-zero exit and concise stderr on an init conflict', () => {
    const installation = createInstalledPackageTestEnvironment('installed-init-');

    try {
      mkdirSync(join(installation.installDirectory, 'docs', 'scifi'), { recursive: true });
      writeFileSync(
        join(installation.installDirectory, 'docs', 'scifi', 'bugs'),
        'conflict',
        'utf8',
      );

      const result = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
        '--yes',
      ]);
      const expectedErrorMessage = `Cannot scaffold directory at ${join(installation.installDirectory, 'docs', 'scifi', 'bugs')}: path exists and is not a directory.`;

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(expectedErrorMessage);
      expect(result.stderr).not.toContain('    at ');
      expect(result.stderr).not.toContain('node:internal');
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', '.scifi'))).toBe(
        false,
      );
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', 'specs'))).toBe(false);
      expect(
        readFileSync(join(installation.installDirectory, 'docs', 'scifi', 'bugs'), 'utf8'),
      ).toBe('conflict');
      expect(
        existsSync(join(installation.installDirectory, 'docs', 'scifi', 'EVALUATION.md')),
      ).toBe(false);
      expect(existsSync(join(installation.installDirectory, 'docs', 'scifi', 'ROADMAP.md'))).toBe(
        false,
      );
      expect(existsSync(join(installation.installDirectory, '.claude'))).toBe(false);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('returns a stable non-zero exit when the chosen harness is not implemented', () => {
    const installation = createInstalledPackageTestEnvironment('installed-init-');

    try {
      const result = runInstalledInit(installation.installDirectory, ['--harness', 'opencode']);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('opencode');
      expect(result.stderr).toContain('not implemented');
      expect(existsSync(join(installation.installDirectory, '.claude'))).toBe(false);
      expect(
        existsSync(join(installation.installDirectory, 'docs', 'scifi', 'EVALUATION.md')),
      ).toBe(false);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
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

const preservedEvaluationDocument = `# EVALUATION.md

Preserve this custom evaluation note on rerun.
`;

const preservedSpecDocument = `# Existing Spec

This generated spec file must survive init reruns.
`;

const preservedBugDocument = `# Existing Bug

This generated bug file must survive init reruns.
`;

const preservedStateDocument = `{"initialized":true,"preserve":"yes"}\n`;
