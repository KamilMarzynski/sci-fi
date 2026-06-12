import { cwd, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { type Command, Option } from 'commander';
import { readConfig } from '../../core/init/config.js';
import { installSkills } from '../../core/init/install-skills.js';
import { emitError, emitSuccess, isInteractive, jsonMode } from '../../core/output/index.js';
import { findPackageRoot } from '../../core/package-root.js';
import type { HarnessId } from '../../core/skills/harness/adapter.js';
import { spawnSkillInstall } from '../../core/upgrade/child.js';
import { npmGlobalInstall, npmGlobalPrefix, resolveGlobalBinPath } from '../../core/upgrade/npm.js';
import { readCurrentVersion, readNewVersion } from '../../core/upgrade/version.js';

interface UpgradeCommandOptions {
  readonly yes?: boolean;
  readonly json?: boolean;
  readonly _install?: boolean;
  readonly projectRoot?: string;
  readonly harnesses?: string;
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade scifi to the latest version')
    .option('--yes', 'skip confirmation prompt')
    .option('--json', 'output as structured JSON')
    .addOption(new Option('--_install', 'internal install mode (used by child process)').hideHelp())
    .option('--project-root <path>', 'project root directory')
    .option('--harnesses <ids>', 'comma-separated harness IDs')
    .action(async (options: UpgradeCommandOptions, command: Command) => {
      if (options._install) {
        await runInstallMode(options);
        return;
      }

      await runUserMode(options, command);
    });
}

async function runInstallMode(options: UpgradeCommandOptions): Promise<void> {
  const projectRoot = options.projectRoot ?? '';
  const harnessesRaw = options.harnesses ?? '';
  // Safe: parent process passes only validated HarnessId values from config.
  const harnesses = harnessesRaw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0) as HarnessId[];

  const packageRoot = findPackageRoot(import.meta.url);

  const report = await installSkills({ projectRoot, harnesses, packageRoot });

  stdout.write(`${JSON.stringify(report)}\n`);
}

async function runUserMode(options: UpgradeCommandOptions, command: Command): Promise<void> {
  const json = jsonMode(command);

  try {
    const projectRoot = cwd();
    const packageRoot = findPackageRoot(import.meta.url);

    const config = await readConfig(projectRoot);
    const previousVersion = readCurrentVersion(packageRoot);

    // Confirmation prompt
    if (options.yes !== true && isInteractive()) {
      const proceed = await askUpgradeConfirmation();
      if (!proceed) {
        stdout.write('Upgrade cancelled.\n');
        process.exitCode = 0;
        return;
      }
    }

    // Phase 1: npm global install
    // Always run npm install — comparing local versions cannot detect whether
    // a newer release exists on the registry. npm install is idempotent when
    // already at latest, so running it unconditionally is safe.
    try {
      await npmGlobalInstall('@kamilmarzynski/scifi');
    } catch (error) {
      emitError(error, json);
      return;
    }

    const prefix = await npmGlobalPrefix();
    const binPath = resolveGlobalBinPath(prefix, 'scifi');
    const newVersion = await readNewVersion(binPath);
    const npmUpgraded = newVersion !== previousVersion;

    // Phase 2: skill re-install via child process
    const installReport = await spawnSkillInstall({
      binPath,
      projectRoot,
      harnesses: config.harnesses,
    });

    // Build output
    const versionLine = formatVersionChange(previousVersion, newVersion);

    const installedLines = installReport.installed.flatMap((entry) => [
      `  Harness: ${entry.harness}`,
      `  Location: ${entry.baseDir}`,
      `  Skills: ${entry.skills.join(', ')}`,
    ]);

    const failedSummary =
      installReport.failed.length > 0
        ? installReport.failed.map((f) => `  Failed:  ${f.harness} (${f.error.message})`)
        : [];

    emitSuccess(
      {
        action: 'upgrade',
        previousVersion,
        newVersion,
        npmUpgraded,
        harnesses: config.harnesses,
        installed: installReport.installed,
        failed: installReport.failed.map((f) => ({
          harness: f.harness,
          error: f.error.message,
        })),
      },
      json,
      [`scifi upgraded successfully.`, `  ${versionLine}`, ...installedLines, ...failedSummary],
    );
  } catch (error) {
    emitError(error, json);
  }
}

function formatVersionChange(previous: string, next: string): string {
  const direction = isDowngrade(previous, next) ? ' (latest stable)' : '';
  return `Changing scifi from ${previous} to ${next}${direction}`;
}

// Non-numeric suffixes (e.g. "-pre" in "1.0.0-pre") produce NaN from Number(),
// which is treated as equal to its numeric base for comparison — intentional.
function isDowngrade(previous: string, next: string): boolean {
  const prevParts = previous.split('.').map(Number);
  const nextParts = next.split('.').map(Number);

  for (let i = 0; i < Math.max(prevParts.length, nextParts.length); i++) {
    const p = prevParts[i] ?? 0;
    const n = nextParts[i] ?? 0;
    if (n > p) return false;
    if (n < p) return true;
  }

  return false;
}

async function askUpgradeConfirmation(): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question('Upgrade scifi to latest? [y/N] ')).trim();
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}
