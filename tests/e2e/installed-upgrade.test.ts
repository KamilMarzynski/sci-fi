import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  repositoryRoot,
  runInstalledCommand,
  runInstalledInit,
} from './installed-test-helpers.js';

/**
 * The version the installed package reports comes from the repo's
 * package.json — the same file the release process bumps. Read it here so
 * assertions track the real version instead of a literal that goes stale on
 * every release.
 */
function readRepositoryVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'version' in parsed &&
    typeof parsed.version === 'string'
  ) {
    return parsed.version;
  }
  throw new Error('Could not read string version from repository package.json');
}

const currentVersion = readRepositoryVersion();

/**
 * Create a mock `npm` shell script at `<mockDir>/npm` that returns
 * controlled responses. The script is made executable.
 *
 * The mock handles:
 *   `install -g <pkg>@latest` → exits 0 (success) or configured exit code
 *   `prefix -g`              → prints the configured prefix path to stdout
 */
function createMockNpm(
  mockDir: string,
  options: { prefixPath: string; installExitCode?: number; installStderr?: string },
): void {
  mkdirSync(mockDir, { recursive: true });

  const installExitCode = options.installExitCode ?? 0;
  const installStderr = options.installStderr ?? '';

  const script = `#!/bin/bash
case "$1" in
  install)
    ${installStderr ? `echo "${installStderr}" >&2` : ''}
    exit ${installExitCode}
    ;;
  prefix)
    echo "${options.prefixPath}"
    exit 0
    ;;
  *)
    echo "mock npm: unexpected command $1" >&2
    exit 1
    ;;
esac
`;

  const scriptPath = join(mockDir, 'npm');
  writeFileSync(scriptPath, script, { encoding: 'utf8', mode: 0o755 });
}

/**
 * Create a mock `scifi` shell script at `<mockGlobalDir>/bin/scifi` that
 * handles `--version` and `upgrade --_install` invocations.
 *
 * For the success path, `upgrade --_install` execs the real scifi binary.
 * For failure testing, the script can be configured to exit non-zero.
 */
function createMockScifi(
  mockGlobalDir: string,
  options: {
    versionOutput: string;
    realScifiPath?: string;
    upgradeExitCode?: number;
    upgradeStderr?: string;
  },
): void {
  const binDir = join(mockGlobalDir, 'bin');
  mkdirSync(binDir, { recursive: true });

  let upgradeHandler: string;
  if (options.realScifiPath) {
    // Exec the real scifi binary for actual skill installation
    upgradeHandler = `exec "${options.realScifiPath}" "$@"`;
  } else {
    const exitCode = options.upgradeExitCode ?? 0;
    const stderr = options.upgradeStderr ?? '';
    upgradeHandler = `${stderr ? `echo "${stderr}" >&2` : ''}
    exit ${exitCode}`;
  }

  const script = `#!/bin/bash
case "$1" in
  --version)
    echo "${options.versionOutput}"
    exit 0
    ;;
  upgrade)
    ${upgradeHandler}
    ;;
  *)
    echo "mock scifi: unexpected arg $1" >&2
    exit 1
    ;;
esac
`;

  const scriptPath = join(binDir, 'scifi');
  writeFileSync(scriptPath, script, { encoding: 'utf8', mode: 0o755 });
}

describe('installed build upgrade verification', () => {
  it('registers the upgrade command and shows help text', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Initialize a project first so the command can resolve config
      const initResult = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
      ]);
      expect(initResult.status).toBe(0);

      // Verify upgrade --help works
      const helpResult = runInstalledCommand(installation.installDirectory, ['upgrade', '--help']);
      expect(helpResult.status).toBe(0);
      expect(helpResult.stdout).toContain('Upgrade scifi to the latest version');
      expect(helpResult.stdout).toContain('--yes');
      expect(helpResult.stdout).toContain('--json');
      // --_install should NOT appear in help
      expect(helpResult.stdout).not.toContain('--_install');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('full success path: upgrades, re-installs skills, outputs correct JSON', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Init with two harnesses
      const initResult = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
        '--harness',
        'cursor',
      ]);
      expect(initResult.status).toBe(0);

      // Set up mock npm and mock scifi
      const mockBinDir = join(installation.sandboxRoot, 'mock-bin');
      const mockGlobalDir = join(installation.sandboxRoot, 'mock-global');
      const realScifiPath = join(installation.installDirectory, 'node_modules', '.bin', 'scifi');

      createMockNpm(mockBinDir, { prefixPath: mockGlobalDir });
      createMockScifi(mockGlobalDir, {
        versionOutput: '99.99.99',
        realScifiPath,
      });

      // Run upgrade with mock npm in PATH
      const env = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
      };

      const result = runInstalledCommand(
        installation.installDirectory,
        ['upgrade', '--yes', '--json'],
        env,
      );

      // Exit code 0
      expect(result.status).toBe(0);

      // Parse JSON output
      const parsed = JSON.parse(result.stdout);
      expect(parsed.ok).toBe(true);
      expect(parsed.data).toBeDefined();

      const { data } = parsed;

      // All required keys present
      expect(data).toHaveProperty('action');
      expect(data).toHaveProperty('previousVersion');
      expect(data).toHaveProperty('newVersion');
      expect(data).toHaveProperty('npmUpgraded');
      expect(data).toHaveProperty('harnesses');
      expect(data).toHaveProperty('installed');
      expect(data).toHaveProperty('failed');

      // Value checks
      expect(data.action).toBe('upgrade');
      expect(data.previousVersion).toBe(currentVersion);
      expect(data.newVersion).toBe('99.99.99');
      expect(data.npmUpgraded).toBe(true);

      // harnesses: array of harness IDs from config
      expect(data.harnesses).toEqual(['claude-code', 'cursor']);

      // installed: array of { harness, baseDir, skills }
      expect(data.installed).toHaveLength(2);
      const claudeEntry = data.installed.find(
        (e: { harness: string }) => e.harness === 'claude-code',
      );
      const cursorEntry = data.installed.find((e: { harness: string }) => e.harness === 'cursor');
      expect(claudeEntry).toBeDefined();
      expect(cursorEntry).toBeDefined();
      expect(claudeEntry.baseDir).toBe('.claude/skills');
      expect(cursorEntry.baseDir).toBe('.cursor/skills');
      expect(claudeEntry.skills.length).toBeGreaterThan(0);
      expect(cursorEntry.skills.length).toBeGreaterThan(0);

      // failed: empty array
      expect(data.failed).toEqual([]);

      // Config file unchanged
      const configPath = join(
        installation.installDirectory,
        'docs',
        'scifi',
        '.scifi',
        'config.json',
      );
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      expect(config.version).toBe(1);
      expect([...config.harnesses].sort()).toEqual(['claude-code', 'cursor']);

      // Skill files exist in both harness dirs
      expect(
        existsSync(
          join(installation.installDirectory, '.claude', 'skills', 'sf-feature', 'SKILL.md'),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(installation.installDirectory, '.cursor', 'skills', 'sf-feature', 'SKILL.md'),
        ),
      ).toBe(true);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('already-at-latest: npmUpgraded false, skills still re-installed', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Init with one harness
      const initResult = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
      ]);
      expect(initResult.status).toBe(0);

      // Set up mock npm and mock scifi
      const mockBinDir = join(installation.sandboxRoot, 'mock-bin');
      const mockGlobalDir = join(installation.sandboxRoot, 'mock-global');
      const realScifiPath = join(installation.installDirectory, 'node_modules', '.bin', 'scifi');

      createMockNpm(mockBinDir, { prefixPath: mockGlobalDir });
      // Mock scifi returns the SAME version as current → npmUpgraded should be false
      // npm install always runs; the version comparison happens after install
      createMockScifi(mockGlobalDir, {
        versionOutput: currentVersion, // same as current package version
        realScifiPath, // still execs real scifi for skill install
      });

      const env = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
      };

      const result = runInstalledCommand(
        installation.installDirectory,
        ['upgrade', '--yes', '--json'],
        env,
      );

      expect(result.status).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.ok).toBe(true);

      const { data } = parsed;
      expect(data.npmUpgraded).toBe(false);
      expect(data.previousVersion).toBe(currentVersion);
      expect(data.newVersion).toBe(currentVersion);

      // Skills still re-installed
      expect(data.installed).toHaveLength(1);
      expect(data.installed[0].harness).toBe('claude-code');
      expect(data.installed[0].skills.length).toBeGreaterThan(0);

      // Skill files exist
      expect(
        existsSync(
          join(installation.installDirectory, '.claude', 'skills', 'sf-feature', 'SKILL.md'),
        ),
      ).toBe(true);
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('missing config: errors with "not initialized" message', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Do NOT run init — config file does not exist

      const result = runInstalledCommand(installation.installDirectory, [
        'upgrade',
        '--yes',
        '--json',
      ]);

      // Non-zero exit
      expect(result.status).not.toBe(0);

      // stderr contains the error (JSON mode writes to stderr)
      const parsed = JSON.parse(result.stderr);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('NOT_FOUND');
      expect(parsed.error.message).toContain('not initialized');
      expect(parsed.error.message).toContain('scifi init');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('invalid harness in config: skipped with warning, valid harnesses proceed', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Init with one valid harness
      const initResult = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
      ]);
      expect(initResult.status).toBe(0);

      // Manually write config with an unknown harness ID alongside a valid one
      const configPath = join(
        installation.installDirectory,
        'docs',
        'scifi',
        '.scifi',
        'config.json',
      );
      writeFileSync(
        configPath,
        JSON.stringify({ version: 1, harnesses: ['claude-code', 'unknown-harness'] }),
      );

      // Set up mock npm and mock scifi
      const mockBinDir = join(installation.sandboxRoot, 'mock-bin');
      const mockGlobalDir = join(installation.sandboxRoot, 'mock-global');
      const realScifiPath = join(installation.installDirectory, 'node_modules', '.bin', 'scifi');

      createMockNpm(mockBinDir, { prefixPath: mockGlobalDir });
      createMockScifi(mockGlobalDir, {
        versionOutput: '99.99.99',
        realScifiPath,
      });

      const env = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
      };

      const result = runInstalledCommand(
        installation.installDirectory,
        ['upgrade', '--yes', '--json'],
        env,
      );

      // Should succeed (valid harness proceeds)
      expect(result.status).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.ok).toBe(true);

      const { data } = parsed;
      // Only the valid harness is installed
      expect(data.harnesses).toEqual(['claude-code']);
      expect(data.installed).toHaveLength(1);
      expect(data.installed[0].harness).toBe('claude-code');

      // Warning about unknown harness on stderr (console.warn goes to stderr)
      // Note: console.warn output may interleave; check that the warning appeared
      expect(result.stderr).toContain('unknown-harness');
      expect(result.stderr).toContain('Skipping unknown harness');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('zero valid harnesses: errors when config has only invalid harness IDs', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Create the config directory structure and write a config with only invalid harnesses
      const scifiDir = join(installation.installDirectory, 'docs', 'scifi', '.scifi');
      mkdirSync(scifiDir, { recursive: true });
      writeFileSync(
        join(scifiDir, 'config.json'),
        JSON.stringify({ version: 1, harnesses: ['unknown-1', 'unknown-2'] }),
      );

      const result = runInstalledCommand(installation.installDirectory, [
        'upgrade',
        '--yes',
        '--json',
      ]);

      // Non-zero exit
      expect(result.status).not.toBe(0);

      // stderr contains console.warn lines followed by the JSON error on the last line
      const stderrLines = result.stderr.trim().split('\n');
      const jsonLine = stderrLines[stderrLines.length - 1];
      const parsed = JSON.parse(jsonLine);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('INVALID_ARGUMENT');
      expect(parsed.error.message).toContain('No valid harnesses');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('npm failure: errors before skill re-install', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Init with one harness
      const initResult = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
      ]);
      expect(initResult.status).toBe(0);

      // Set up mock npm that fails on install
      const mockBinDir = join(installation.sandboxRoot, 'mock-bin');
      const mockGlobalDir = join(installation.sandboxRoot, 'mock-global');

      createMockNpm(mockBinDir, {
        prefixPath: mockGlobalDir,
        installExitCode: 1,
        installStderr: 'npm ERR! network error',
      });

      const env = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
      };

      const result = runInstalledCommand(
        installation.installDirectory,
        ['upgrade', '--yes', '--json'],
        env,
      );

      // Non-zero exit
      expect(result.status).not.toBe(0);

      // Error in stderr (JSON mode)
      const stderrLines = result.stderr.trim().split('\n');
      const jsonLine = stderrLines[stderrLines.length - 1];
      const parsed = JSON.parse(jsonLine);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.message).toContain('npm');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });

  it('child process failure: parent reports child error', () => {
    const installation = createInstalledPackageTestEnvironment('installed-upgrade-');

    try {
      // Init with one harness
      const initResult = runInstalledInit(installation.installDirectory, [
        '--harness',
        'claude-code',
      ]);
      expect(initResult.status).toBe(0);

      // Set up mock npm (success) and mock scifi (fails on upgrade --_install)
      const mockBinDir = join(installation.sandboxRoot, 'mock-bin');
      const mockGlobalDir = join(installation.sandboxRoot, 'mock-global');

      createMockNpm(mockBinDir, { prefixPath: mockGlobalDir });
      createMockScifi(mockGlobalDir, {
        versionOutput: '99.99.99',
        upgradeExitCode: 1,
        upgradeStderr: 'permission denied creating skill directory',
      });

      const env = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
      };

      const result = runInstalledCommand(
        installation.installDirectory,
        ['upgrade', '--yes', '--json'],
        env,
      );

      // Non-zero exit
      expect(result.status).not.toBe(0);

      // Error in stderr (JSON mode)
      const stderrLines = result.stderr.trim().split('\n');
      const jsonLine = stderrLines[stderrLines.length - 1];
      const parsed = JSON.parse(jsonLine);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.message).toContain('Child process failed');
      expect(parsed.error.message).toContain('permission denied');
    } finally {
      cleanupInstalledPackageTestEnvironment(installation);
    }
  });
});
