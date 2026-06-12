import { execFile } from 'node:child_process';
import { ScifiError } from '../output/errors.js';
import { readPackageVersion } from '../package-version.js';

/**
 * Read the currently installed scifi version from a package root's package.json.
 *
 * Delegates to `readPackageVersion` for the actual file reading and validation.
 */
export function readCurrentVersion(packageRoot: string): string {
  return readPackageVersion(packageRoot);
}

/**
 * Detect the version of a freshly installed scifi binary by spawning
 * `<binPath> --version` and parsing its stdout.
 *
 * Handles output formats like `"1.1.0"`, `"v1.1.0"`, and `"scifi 1.1.0"`.
 * Throws ScifiError on spawn failure or unparseable output.
 */
export function readNewVersion(binPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binPath, ['--version'], { shell: false }, (error, stdout, _stderr) => {
      if (error) {
        reject(new ScifiError('INTERNAL', `Failed to run ${binPath} --version: ${error.message}`));
        return;
      }

      const version = parseVersionFromStdout(stdout);
      if (version === null) {
        reject(
          new ScifiError(
            'INTERNAL',
            `Could not parse version from ${binPath} --version output: "${stdout.trim()}"`,
          ),
        );
        return;
      }

      resolve(version);
    });
  });
}

/**
 * Extract a version string from CLI `--version` stdout.
 *
 * Handles formats:
 *   - `"1.1.0"`        → `"1.1.0"`
 *   - `"v1.1.0"`       → `"1.1.0"`
 *   - `"scifi 1.1.0"`  → `"1.1.0"`
 *
 * Returns null if no version-like token is found.
 */
function parseVersionFromStdout(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Split on whitespace and examine each token
  const tokens = trimmed.split(/\s+/);

  // A version token: optional leading "v", then digits separated by dots
  const versionPattern = /^v?\d+\.\d+\.\d+/;
  for (const token of tokens) {
    const match = versionPattern.exec(token);
    if (match) {
      // Strip leading "v" if present
      return match[0].replace(/^v/, '');
    }
  }

  return null;
}
