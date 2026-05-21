import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { FIX_STATUS_VALUES, type FixFrontmatter } from "./types.js";

export interface FixFile {
  frontmatter: FixFrontmatter;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function isValidFixStatus(value: unknown): value is FixFrontmatter["status"] {
  return (
    typeof value === "string" &&
    (FIX_STATUS_VALUES as readonly string[]).includes(value)
  );
}

function isValidRawFixFrontmatter(
  raw: unknown,
): raw is Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["slug"] === "string" &&
    isValidFixStatus(obj["status"]) &&
    typeof obj["feature"] === "string" &&
    typeof obj["created"] === "string"
  );
}

export async function readFixFile(filePath: string): Promise<FixFile> {
  const content = await readFile(filePath, "utf8");
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    throw new Error(`Fix file at ${filePath} is missing YAML frontmatter.`);
  }

  const raw = parseYaml(match[1] ?? "") as unknown;

  if (!isValidRawFixFrontmatter(raw)) {
    throw new Error(`Fix file at ${filePath} has invalid frontmatter.`);
  }

  return {
    frontmatter: {
      id: raw["id"] as string,
      slug: raw["slug"] as string,
      status: raw["status"] as FixFrontmatter["status"],
      feature: raw["feature"] as string,
      created: raw["created"] as string,
    },
    body: match[2] ?? "",
  };
}

export async function writeFixFile(
  filePath: string,
  file: FixFile,
): Promise<void> {
  const rawFrontmatter: Record<string, unknown> = {
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    status: file.frontmatter.status,
    feature: file.frontmatter.feature,
    created: file.frontmatter.created,
  };

  const content = `---\n${stringifyYaml(rawFrontmatter)}---\n${file.body}`;
  await writeFile(filePath, content, "utf8");
}
