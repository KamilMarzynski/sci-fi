import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "code-review",
  kind: "subagent",
  description:
    "Quality review of changes against ARCHITECTURE.md and AGENTS.md rules.",
};
