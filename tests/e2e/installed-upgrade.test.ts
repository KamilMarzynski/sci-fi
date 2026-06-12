import { describe, expect, it } from 'vitest';
import {
  cleanupInstalledPackageTestEnvironment,
  createInstalledPackageTestEnvironment,
  runInstalledCommand,
  runInstalledInit,
} from './installed-test-helpers.js';

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
});
