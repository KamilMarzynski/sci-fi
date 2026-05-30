import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-spec-review",
  kind: "subagent",
  description:
    "Critic pass on a spec.md. Surfaces ambiguity, missing AC, CONTEXT.md gaps.",
};
