import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { InstallReport } from '../init/install-skills.js';
import { ScifiError } from '../output/errors.js';
import type { HarnessId } from '../skills/harness/adapter.js';

export interface SkillInstallArgs {
  readonly binPath: string;
  readonly projectRoot: string;
  readonly harnesses: readonly HarnessId[];
}

export function spawnSkillInstall(args: SkillInstallArgs): Promise<InstallReport> {
  return new Promise((resolve, reject) => {
    if (!existsSync(args.binPath)) {
      reject(
        new ScifiError('INTERNAL', `New scifi binary not found at "${args.binPath}".`, {
          hint: 'Re-run "npm install -g scifi" manually.',
        }),
      );
      return;
    }

    const harnessesArg = args.harnesses.join(',');

    execFile(
      args.binPath,
      ['upgrade', '--_install', '--project-root', args.projectRoot, '--harnesses', harnessesArg],
      { shell: false },
      (error, stdout, stderr) => {
        if (error) {
          reject(new ScifiError('INTERNAL', `Child process failed: ${stderr.trim()}`));
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(
            new ScifiError(
              'INTERNAL',
              `Child process produced unparseable output: ${stdout.slice(0, 200)}`,
            ),
          );
          return;
        }

        // Runtime shape validation: narrowed to non-null object above;
        // safe property access for InstallReport shape check.
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('installed' in parsed) ||
          !('failed' in parsed) ||
          !Array.isArray((parsed as Record<string, unknown>).installed) ||
          !Array.isArray((parsed as Record<string, unknown>).failed)
        ) {
          reject(
            new ScifiError(
              'INTERNAL',
              `Child process produced output with unexpected shape: ${stdout.slice(0, 200)}`,
            ),
          );
          return;
        }

        resolve(parsed as InstallReport);
      },
    );
  });
}
