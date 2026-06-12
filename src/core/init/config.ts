import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ScifiError } from '../output/errors.js';
import { type HarnessId, isHarnessId, KNOWN_HARNESS_IDS } from '../skills/harness/adapter.js';

export interface Config {
  readonly version: number;
  readonly harnesses: readonly HarnessId[];
}

export interface WriteConfigOptions {
  readonly projectRoot: string;
  readonly harnesses: readonly HarnessId[];
}

export async function readConfig(projectRoot: string): Promise<Config> {
  const configPath = join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      throw new ScifiError('NOT_FOUND', 'Project is not initialized. Run `scifi init` first.');
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ScifiError('INVALID_ARGUMENT', 'Config file contains malformed JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || !('harnesses' in parsed)) {
    throw new ScifiError('INVALID_ARGUMENT', 'Config file is missing the "harnesses" key.');
  }

  const obj = parsed as Record<string, unknown>;
  const harnessesRaw = obj.harnesses;

  if (!Array.isArray(harnessesRaw)) {
    throw new ScifiError('INVALID_ARGUMENT', 'Config "harnesses" must be an array.');
  }

  for (const entry of harnessesRaw) {
    if (typeof entry !== 'string') {
      throw new ScifiError(
        'INVALID_ARGUMENT',
        'Config "harnesses" must contain only string entries.',
      );
    }
  }

  const validHarnesses: HarnessId[] = [];
  for (const entry of harnessesRaw as string[]) {
    if (isHarnessId(entry)) {
      if (!validHarnesses.includes(entry)) {
        validHarnesses.push(entry);
      }
    } else {
      console.warn(
        `Skipping unknown harness "${entry}". Expected one of: ${KNOWN_HARNESS_IDS.join(', ')}.`,
      );
    }
  }

  if (validHarnesses.length === 0) {
    throw new ScifiError(
      'INVALID_ARGUMENT',
      'No valid harnesses remain after filtering. Run `scifi init` to reconfigure.',
    );
  }

  return {
    version: typeof obj.version === 'number' ? obj.version : 1,
    harnesses: validHarnesses,
  };
}

export async function writeConfig(options: WriteConfigOptions): Promise<void> {
  const configPath = join(options.projectRoot, 'docs', 'scifi', '.scifi', 'config.json');

  const document = JSON.stringify({ version: 1, harnesses: options.harnesses });

  await writeFile(configPath, document, {
    encoding: 'utf8',
    flag: 'wx',
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'EEXIST'
    ) {
      return;
    }

    throw error;
  });
}
