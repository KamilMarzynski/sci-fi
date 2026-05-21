import { mkdir, readdir } from "node:fs/promises";
import { writeBugFile } from "./frontmatter.js";
import { formatBugId } from "./id.js";
import { buildBugFilePath, buildBugsRootPath } from "./paths.js";
import type { BugSeverity } from "./types.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CreateBugOptions {
  projectRoot: string;
  description: string;
  relatedFeature?: string;
  severity?: BugSeverity;
  now: string;
}

export interface CreateBugResult {
  id: string;
  filePath: string;
}

export async function createBug(
  options: CreateBugOptions,
): Promise<CreateBugResult> {
  const { projectRoot, description, relatedFeature, severity, now } = options;
  const bugsRoot = buildBugsRootPath(projectRoot);

  await mkdir(bugsRoot, { recursive: true });

  const existing = await readdir(bugsRoot, { withFileTypes: true });
  const mdCount = existing.filter(
    (e) => e.isFile() && e.name.endsWith(".md"),
  ).length;

  const id = formatBugId(mdCount + 1);
  const slug = slugify(description);
  const filePath = buildBugFilePath(projectRoot, id, slug);

  await writeBugFile(filePath, {
    frontmatter: {
      id,
      slug,
      status: "open",
      ...(severity !== undefined && { severity }),
      ...(relatedFeature !== undefined && { "related-feature": relatedFeature }),
      created: now,
    },
    body: `# ${description}\n`,
  });

  return { id, filePath };
}
