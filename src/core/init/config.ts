import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessId } from '../skills/harness/adapter.js';

export interface WriteConfigOptions {
  readonly projectRoot: string;
  readonly harness: HarnessId;
}

export async function writeConfig(options: WriteConfigOptions): Promise<void> {
  const configPath = join(options.projectRoot, 'docs', 'specflow', '.specflow', 'config.json');

  const document = JSON.stringify({ version: 1, harness: options.harness });

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
