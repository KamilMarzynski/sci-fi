import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import type {
  SkillBundle,
  SkillManifest,
  SubagentSkillManifest,
  UserSkillManifest,
} from "../types.js";
import type { HarnessAdapter } from "./adapter.js";

export const claudeCodeAdapter: HarnessAdapter = {
  id: "claude-code",
  async install(bundles, projectRoot) {
    for (const bundle of bundles) {
      const targetPath = resolveTargetPath(bundle.manifest, projectRoot);
      const document = renderDocument(bundle);

      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, document, { encoding: "utf8" });
    }
  },
};

function resolveTargetPath(
  manifest: SkillManifest,
  projectRoot: string,
): string {
  if (manifest.kind === "subagent") {
    return join(projectRoot, ".claude", "agents", `${manifest.id}.md`);
  }

  return join(
    projectRoot,
    ".claude",
    "skills",
    manifest.id,
    "SKILL.md",
  );
}

function renderDocument(bundle: SkillBundle): string {
  const frontmatter = buildFrontmatter(bundle.manifest);
  const serialized = stringify(frontmatter).trimEnd();

  return `---\n${serialized}\n---\n${bundle.body}`;
}

function buildFrontmatter(manifest: SkillManifest): Record<string, unknown> {
  if (manifest.kind === "subagent") {
    return buildSubagentFrontmatter(manifest);
  }

  return buildUserFrontmatter(manifest);
}

function buildUserFrontmatter(
  manifest: UserSkillManifest,
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    name: manifest.id,
    description: manifest.description,
  };

  if (manifest.argumentHint !== undefined) {
    frontmatter["argument-hint"] = manifest.argumentHint;
  }

  if (manifest.allowedTools !== undefined) {
    frontmatter["allowed-tools"] = manifest.allowedTools.join(", ");
  }

  if (manifest.disableModelInvocation === true) {
    frontmatter["disable-model-invocation"] = true;
  }

  return frontmatter;
}

function buildSubagentFrontmatter(
  manifest: SubagentSkillManifest,
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    name: manifest.id,
    description: manifest.description,
  };

  if (manifest.allowedTools !== undefined) {
    frontmatter.tools = manifest.allowedTools.join(", ");
  }

  if (manifest.model !== undefined) {
    frontmatter.model = manifest.model;
  }

  return frontmatter;
}
