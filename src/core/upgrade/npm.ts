import { execFile } from 'node:child_process';
import path from 'node:path';
import { ScifiError } from '../output/errors.js';

/**
 * Result of an npm spawn command.
 */
export interface NpmSpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn an npm command via execFile and return the captured output.
 *
 * Uses `shell: false` for reliable process execution.
 * Maps spawn errors (ENOENT, EACCES, EPERM) to ScifiError with appropriate hints.
 * On non-zero exit, includes stderr in the error message.
 */
function spawnNpm(args: readonly string[]): Promise<NpmSpawnResult> {
  return new Promise((resolve, reject) => {
    execFile('npm', args, { shell: false }, (error, stdout, stderr) => {
      if (error) {
        // Classify spawn-level errors (process failed to start)
        if (error.code === 'ENOENT') {
          reject(
            new ScifiError('INTERNAL', 'npm is not available on this system.', {
              hint: 'Install Node.js and npm, then try again.',
            }),
          );
          return;
        }
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          reject(
            new ScifiError('INTERNAL', 'Permission denied while running npm.', {
              hint: 'Check your npm prefix permissions or use sudo.',
            }),
          );
          return;
        }

        // Non-zero exit code — error object has exit code in its properties
        const code = error.code;
        const exitCode = typeof code === 'number' ? code : 1;
        reject(new ScifiError('INTERNAL', `npm exited with code ${exitCode}: ${stderr.trim()}`));
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode: 0,
      });
    });
  });
}

/**
 * Run `npm install -g <packageName>@latest` and return the captured output.
 */
export async function npmGlobalInstall(packageName: string): Promise<NpmSpawnResult> {
  return spawnNpm(['install', '-g', `${packageName}@latest`]);
}

/**
 * Run `npm prefix -g` and return the trimmed global prefix path.
 */
export async function npmGlobalPrefix(): Promise<string> {
  const result = await spawnNpm(['prefix', '-g']);
  return result.stdout.trim();
}

/**
 * Resolve the platform-specific global binary path for a given npm package.
 *
 * On Unix: `<prefix>/bin/<name>`
 * On Windows: `<prefix>/<name>.cmd`
 */
export function resolveGlobalBinPath(prefix: string, binName: string): string {
  if (process.platform === 'win32') {
    return path.win32.join(prefix, `${binName}.cmd`);
  }
  return path.posix.join(prefix, 'bin', binName);
}
