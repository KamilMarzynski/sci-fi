import { readFile, writeFile } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  BUG_SEVERITY_VALUES,
  BUG_STATUS_VALUES,
  type BugFrontmatter,
  type BugSeverity,
} from './types.js';

export interface BugFile {
  frontmatter: BugFrontmatter;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function isValidBugStatus(value: unknown): value is BugFrontmatter['status'] {
  return typeof value === 'string' && (BUG_STATUS_VALUES as readonly string[]).includes(value);
}

function isValidBugSeverity(value: unknown): value is BugSeverity {
  return typeof value === 'string' && (BUG_SEVERITY_VALUES as readonly string[]).includes(value);
}

function isValidRawBugFrontmatter(raw: unknown): raw is Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.slug === 'string' &&
    isValidBugStatus(obj.status) &&
    (obj.severity === undefined || isValidBugSeverity(obj.severity)) &&
    (typeof obj['related-feature'] === 'string' || obj['related-feature'] === undefined) &&
    typeof obj.created === 'string'
  );
}

export async function readBugFile(filePath: string): Promise<BugFile> {
  const content = await readFile(filePath, 'utf8');
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    throw new Error(`Bug file at ${filePath} is missing YAML frontmatter.`);
  }

  const raw = parseYaml(match[1] ?? '') as unknown;

  if (!isValidRawBugFrontmatter(raw)) {
    throw new Error(`Bug file at ${filePath} has invalid frontmatter.`);
  }

  const frontmatter: BugFrontmatter = {
    id: raw.id as string,
    slug: raw.slug as string,
    status: raw.status as BugFrontmatter['status'],
    created: raw.created as string,
  };

  if (raw.severity !== undefined) {
    frontmatter.severity = raw.severity as BugSeverity;
  }
  if (raw['related-feature'] !== undefined) {
    frontmatter['related-feature'] = raw['related-feature'] as string;
  }

  return {
    frontmatter,
    body: match[2] ?? '',
  };
}

export async function writeBugFile(filePath: string, file: BugFile): Promise<void> {
  const rawFrontmatter: Record<string, unknown> = {
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    status: file.frontmatter.status,
    ...(file.frontmatter.severity !== undefined && {
      severity: file.frontmatter.severity,
    }),
    ...(file.frontmatter['related-feature'] !== undefined && {
      'related-feature': file.frontmatter['related-feature'],
    }),
    created: file.frontmatter.created,
  };

  const content = `---\n${stringifyYaml(rawFrontmatter)}---\n${file.body}`;
  await writeFile(filePath, content, 'utf8');
}
