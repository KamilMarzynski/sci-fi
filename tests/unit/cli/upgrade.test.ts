import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildProgram } from '../../../src/cli/index.js';

// Mock core modules used by the upgrade command handler
vi.mock('../../../src/core/init/install-skills.js', () => ({
  installSkills: vi.fn(),
}));

vi.mock('../../../src/core/init/config.js', () => ({
  readConfig: vi.fn(),
}));

vi.mock('../../../src/core/package-root.js', () => ({
  findPackageRoot: vi.fn(),
}));

vi.mock('../../../src/core/upgrade/npm.js', () => ({
  npmGlobalInstall: vi.fn(),
  npmGlobalPrefix: vi.fn(),
  resolveGlobalBinPath: vi.fn(),
}));

vi.mock('../../../src/core/upgrade/version.js', () => ({
  readCurrentVersion: vi.fn(),
  readNewVersion: vi.fn(),
}));

vi.mock('../../../src/core/upgrade/child.js', () => ({
  spawnSkillInstall: vi.fn(),
}));

import { readConfig } from '../../../src/core/init/config.js';
import { installSkills } from '../../../src/core/init/install-skills.js';
import { findPackageRoot } from '../../../src/core/package-root.js';
import { spawnSkillInstall } from '../../../src/core/upgrade/child.js';
import {
  npmGlobalInstall,
  npmGlobalPrefix,
  resolveGlobalBinPath,
} from '../../../src/core/upgrade/npm.js';
import { readCurrentVersion, readNewVersion } from '../../../src/core/upgrade/version.js';

const mockInstallSkills = vi.mocked(installSkills);
const mockReadConfig = vi.mocked(readConfig);
const mockFindPackageRoot = vi.mocked(findPackageRoot);
const mockNpmGlobalInstall = vi.mocked(npmGlobalInstall);
const mockNpmGlobalPrefix = vi.mocked(npmGlobalPrefix);
const mockResolveGlobalBinPath = vi.mocked(resolveGlobalBinPath);
const mockReadCurrentVersion = vi.mocked(readCurrentVersion);
const mockReadNewVersion = vi.mocked(readNewVersion);
const mockSpawnSkillInstall = vi.mocked(spawnSkillInstall);

// Create a fake package root with a valid package.json so buildProgram() works
let fakePackageRoot: string;

beforeAll(() => {
  fakePackageRoot = mkdtempSync(join(tmpdir(), 'scifi-upgrade-test-'));
  writeFileSync(
    join(fakePackageRoot, 'package.json'),
    JSON.stringify({ name: 'scifi', version: '1.0.0' }),
  );
  mockFindPackageRoot.mockReturnValue(fakePackageRoot);
});

afterEach(() => {
  vi.clearAllMocks();
  // Restore default mock returns so parsing tests don't trigger user-facing errors
  mockFindPackageRoot.mockReturnValue(fakePackageRoot);
  mockReadConfig.mockResolvedValue({ version: 1, harnesses: ['claude-code'] });
  mockReadCurrentVersion.mockReturnValue('1.0.0');
  mockNpmGlobalInstall.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  mockNpmGlobalPrefix.mockResolvedValue('/usr/local/lib/node_modules');
  mockResolveGlobalBinPath.mockReturnValue('/usr/local/bin/scifi');
  mockReadNewVersion.mockResolvedValue('1.0.0');
  mockSpawnSkillInstall.mockResolvedValue({ installed: [], failed: [] });
});

// Clean up the temp directory after all tests
afterAll(() => {
  rmSync(fakePackageRoot, { force: true, recursive: true });
});

describe('registerUpgradeCommand', () => {
  it('registers the upgrade command on the program', () => {
    const program = buildProgram();
    const commandNames = program.commands.map((cmd) => cmd.name());

    expect(commandNames).toContain('upgrade');
  });

  it('parses --yes and --json flags', async () => {
    // Capture stdout/stderr to avoid leaking output from the action handler
    const out: string[] = [];
    const err: string[] = [];
    const originalOut = process.stdout.write.bind(process.stdout);
    const originalErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') out.push(chunk);
      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') err.push(chunk);
      return true;
    };

    try {
      const program = buildProgram();

      const parsed = await program.parseAsync(['node', 'scifi', 'upgrade', '--yes', '--json']);

      const opts = parsed.commands.find((cmd) => cmd.name() === 'upgrade')?.opts() as
        | Record<string, unknown>
        | undefined;

      expect(opts).toBeDefined();
      expect(opts?.yes).toBe(true);
      expect(opts?.json).toBe(true);
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  });

  it('accepts --_install flag (hidden from help text)', async () => {
    // Capture stdout/stderr to avoid leaking output from the action handler
    const out: string[] = [];
    const err: string[] = [];
    const originalOut = process.stdout.write.bind(process.stdout);
    const originalErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') out.push(chunk);
      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      if (typeof chunk === 'string') err.push(chunk);
      return true;
    };

    try {
      const program = buildProgram();

      const parsed = await program.parseAsync(['node', 'scifi', 'upgrade', '--_install']);

      const opts = parsed.commands.find((cmd) => cmd.name() === 'upgrade')?.opts() as
        | Record<string, unknown>
        | undefined;

      expect(opts).toBeDefined();
      expect(opts?._install).toBe(true);

      // Verify --_install does not appear in help text
      const upgradeCmd = program.commands.find((cmd) => cmd.name() === 'upgrade');
      expect(upgradeCmd).toBeDefined();
      const helpText = upgradeCmd?.helpInformation();
      expect(helpText).not.toContain('--_install');
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  });

  describe('--_install mode', () => {
    it('calls installSkills directly and outputs InstallReport as JSON to stdout', async () => {
      const installReport = {
        installed: [
          { harness: 'claude-code', baseDir: '/some/dir', skills: ['sf-fix', 'sf-feature'] },
        ],
        failed: [],
      };

      mockInstallSkills.mockResolvedValue(installReport);
      // findPackageRoot already returns fakePackageRoot from beforeAll

      const out: string[] = [];
      const originalOut = process.stdout.write.bind(process.stdout);
      const originalExitCode = process.exitCode;

      process.exitCode = 0;
      process.stdout.write = (chunk: string | Uint8Array): boolean => {
        if (typeof chunk === 'string') out.push(chunk);
        return true;
      };

      try {
        await buildProgram().parseAsync([
          'node',
          'scifi',
          'upgrade',
          '--_install',
          '--project-root',
          '/my/project',
          '--harnesses',
          'claude-code,opencode',
        ]);
      } finally {
        process.stdout.write = originalOut;
        process.exitCode = originalExitCode;
      }

      const stdout = out.join('');
      const parsed: unknown = JSON.parse(stdout);

      expect(parsed).toEqual(installReport);
      expect(mockInstallSkills).toHaveBeenCalledWith({
        projectRoot: '/my/project',
        harnesses: ['claude-code', 'opencode'],
        packageRoot: fakePackageRoot,
      });
      expect(process.exitCode).toBe(0);
    });
  });

  describe('user-facing mode', () => {
    it('produces direction-aware message when previousVersion > newVersion (downgrade)', async () => {
      mockReadConfig.mockResolvedValue({
        version: 1,
        harnesses: ['claude-code'],
      });
      mockReadCurrentVersion.mockReturnValue('1.1.0-pre');
      mockNpmGlobalInstall.mockResolvedValue({
        stdout: 'added 1 package',
        stderr: '',
        exitCode: 0,
      });
      mockNpmGlobalPrefix.mockResolvedValue('/usr/local/lib/node_modules');
      mockResolveGlobalBinPath.mockReturnValue('/usr/local/bin/scifi');
      mockReadNewVersion.mockResolvedValue('1.0.0');
      mockSpawnSkillInstall.mockResolvedValue({
        installed: [{ harness: 'claude-code', baseDir: '/some/dir', skills: ['sf-fix'] }],
        failed: [],
      });

      const out: string[] = [];
      const originalOut = process.stdout.write.bind(process.stdout);
      const originalExitCode = process.exitCode;

      process.exitCode = 0;
      process.stdout.write = (chunk: string | Uint8Array): boolean => {
        if (typeof chunk === 'string') out.push(chunk);
        return true;
      };

      try {
        await buildProgram().parseAsync(['node', 'scifi', 'upgrade', '--yes']);
      } finally {
        process.stdout.write = originalOut;
        process.exitCode = originalExitCode;
      }

      const stdout = out.join('');
      expect(stdout).toContain('Changing scifi from 1.1.0-pre to 1.0.0');
      expect(stdout).toContain('latest stable');
    });
  });
});
