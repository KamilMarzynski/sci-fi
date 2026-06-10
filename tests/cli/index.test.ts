import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildProgram, isDirectExecution } from '../../src/cli/index.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

describe('buildProgram', () => {
  it('registers expected commands', () => {
    const program = buildProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain('init');
    expect(commandNames).toContain('spec');
    expect(commandNames).toContain('spec-ready');
    expect(commandNames).toContain('plan-ready');
    expect(commandNames).toContain('start');
    expect(commandNames).toContain('finish');
    expect(commandNames).toContain('list');
    expect(commandNames).toContain('status');
    expect(commandNames).toContain('task');
  });

  it('runs init against the current working directory', async () => {
    const program = buildProgram();
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-build-program-'));
    const originalWorkingDirectory = process.cwd();

    process.chdir(projectRoot);

    try {
      const parsedProgram = await program.parseAsync([
        'node',
        'scifi',
        'init',
        '--harness',
        'claude-code',
        '--yes',
      ]);

      expect(parsedProgram).toBe(program);

      expect(existsSync(join(projectRoot, 'docs', 'scifi', '.scifi'))).toBe(true);
      expect(existsSync(join(projectRoot, 'docs', 'scifi', 'specs'))).toBe(true);
    } finally {
      process.chdir(originalWorkingDirectory);
      rmSync(projectRoot, { force: true, recursive: true });
    }
  });
});

describe('isDirectExecution', () => {
  it('matches normalized filesystem paths', () => {
    expect(
      isDirectExecution('file:///Users/mayk/Projects/private/sci-fi/dist/cli/index.js', [
        'node',
        '/Users/mayk/Projects/private/sci-fi/dist/cli/../cli/index.js',
      ]),
    ).toBe(true);
  });

  it('returns false when no script path is provided', () => {
    expect(
      isDirectExecution('file:///Users/mayk/Projects/private/sci-fi/dist/cli/index.js', ['node']),
    ).toBe(false);
  });
});

describe('installed artifact cli', () => {
  it('initializes the project structure from the installed bin', () => {
    const sandboxRoot = mkdtempSync(join(tmpdir(), 'scifi-installed-cli-'));
    const packDirectory = join(sandboxRoot, 'pack');
    const installDirectory = join(sandboxRoot, 'install');
    const cacheDirectory = join(sandboxRoot, '.npm-cache');
    const npmEnvironment = {
      ...process.env,
      npm_config_cache: cacheDirectory,
    };

    try {
      mkdirSync(packDirectory, { recursive: true });
      mkdirSync(installDirectory, { recursive: true });
      mkdirSync(cacheDirectory, { recursive: true });

      execFileSync('npm', ['pack', '--pack-destination', packDirectory], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: npmEnvironment,
      });

      const [artifactName] = readdirSync(packDirectory).filter((entry) => entry.endsWith('.tgz'));
      expect(artifactName).toBeDefined();

      if (artifactName === undefined) {
        throw new Error('Expected npm pack to produce a .tgz artifact');
      }

      execFileSync(
        'npm',
        ['pack', './node_modules/commander', '--pack-destination', packDirectory],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          env: npmEnvironment,
        },
      );

      const [commanderArtifactName] = readdirSync(packDirectory).filter(
        (entry) => entry.startsWith('commander-') && entry.endsWith('.tgz'),
      );
      expect(commanderArtifactName).toBeDefined();

      if (commanderArtifactName === undefined) {
        throw new Error('Expected commander tarball for offline install');
      }

      execFileSync('npm', ['pack', './node_modules/yaml', '--pack-destination', packDirectory], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: npmEnvironment,
      });

      const [yamlArtifactName] = readdirSync(packDirectory).filter(
        (entry) => entry.startsWith('yaml-') && entry.endsWith('.tgz'),
      );
      expect(yamlArtifactName).toBeDefined();

      if (yamlArtifactName === undefined) {
        throw new Error('Expected yaml tarball for offline install');
      }

      execFileSync('npm', ['pack', './node_modules/zod', '--pack-destination', packDirectory], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: npmEnvironment,
      });

      const [zodArtifactName] = readdirSync(packDirectory).filter(
        (entry) => entry.startsWith('zod-') && entry.endsWith('.tgz'),
      );
      expect(zodArtifactName).toBeDefined();

      if (zodArtifactName === undefined) {
        throw new Error('Expected zod tarball for offline install');
      }

      writeFileSync(
        join(installDirectory, 'package.json'),
        JSON.stringify({ name: 'scifi-cli-test', private: true }),
      );

      execFileSync(
        'npm',
        [
          'install',
          '--offline',
          '--no-audit',
          '--no-fund',
          '--no-package-lock',
          join(packDirectory, commanderArtifactName),
          join(packDirectory, yamlArtifactName),
          join(packDirectory, zodArtifactName),
          join(packDirectory, artifactName),
        ],
        {
          cwd: installDirectory,
          encoding: 'utf8',
          env: npmEnvironment,
        },
      );

      const installedBinPath = join(installDirectory, 'node_modules/.bin/scifi');

      const result = spawnSync(installedBinPath, ['init', '--harness', 'claude-code', '--yes'], {
        cwd: installDirectory,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(existsSync(join(installDirectory, 'docs', 'scifi', '.scifi'))).toBe(true);
      expect(existsSync(join(installDirectory, 'docs', 'scifi', 'specs'))).toBe(true);
    } finally {
      rmSync(sandboxRoot, { force: true, recursive: true });
    }
  });
});
