import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-spec-review",
  description:
    "Critic pass on a spec.md. Surfaces ambiguity, missing AC, CONTEXT.md gaps.",
};
