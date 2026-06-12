import { createRequire } from 'node:module';

export function readPackageVersion(packageRoot: string): string {
  const require = createRequire(import.meta.url);
  const pkg = require(`${packageRoot}/package.json`) as Record<string, unknown>;

  if (typeof pkg.version !== 'string') {
    throw new Error('package.json is missing a valid "version" field');
  }

  return pkg.version;
}
