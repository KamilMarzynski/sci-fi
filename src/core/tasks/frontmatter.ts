import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { TASK_STATUS_VALUES, type TaskFrontmatter } from "./types.js";

export interface TaskFile {
  frontmatter: TaskFrontmatter;
  body: string;
}

function isValidTaskStatus(value: unknown): value is TaskFrontmatter["status"] {
  return (
    typeof value === "string" &&
    (TASK_STATUS_VALUES as readonly string[]).includes(value)
  );
}

function isValidRawFrontmatter(
  raw: unknown,
): raw is Record<string, unknown> & {
  id: string;
  slug: string;
  status: string;
  parallel: boolean;
  "depends-on": unknown[];
} {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["slug"] === "string" &&
    isValidTaskStatus(obj["status"]) &&
    typeof obj["parallel"] === "boolean" &&
    Array.isArray(obj["depends-on"])
  );
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export async function readTaskFile(filePath: string): Promise<TaskFile> {
  const content = await readFile(filePath, "utf8");
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    throw new Error(`Task file at ${filePath} is missing YAML frontmatter.`);
  }

  const yamlPart = match[1] ?? "";
  const body = match[2] ?? "";
  const raw = parseYaml(yamlPart);

  if (!isValidRawFrontmatter(raw)) {
    throw new Error(`Task file at ${filePath} has invalid frontmatter.`);
  }

  const dependsOnRaw = raw["depends-on"];

  return {
    frontmatter: {
      id: raw.id,
      slug: raw.slug,
      status: raw.status as TaskFrontmatter["status"],
      parallel: raw.parallel,
      dependsOn: dependsOnRaw.filter((v): v is string => typeof v === "string"),
    },
    body,
  };
}

export async function writeTaskFile(filePath: string, file: TaskFile): Promise<void> {
  const rawFrontmatter: Record<string, unknown> = {
    id: file.frontmatter.id,
    slug: file.frontmatter.slug,
    status: file.frontmatter.status,
    parallel: file.frontmatter.parallel,
  };
  rawFrontmatter["depends-on"] = file.frontmatter.dependsOn;

  const content = `---\n${stringifyYaml(rawFrontmatter)}---\n${file.body}`;
  await writeFile(filePath, content, "utf8");
}
