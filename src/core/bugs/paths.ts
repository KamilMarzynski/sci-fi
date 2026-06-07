import { join } from 'node:path';

export function buildBugsRootPath(projectRoot: string): string {
  return join(projectRoot, 'bugs');
}

export function buildBugFilePath(projectRoot: string, id: string, slug: string): string {
  return join(buildBugsRootPath(projectRoot), `${id}-${slug}.md`);
}
