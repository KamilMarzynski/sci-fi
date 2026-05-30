import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-plan-review",
  kind: "subagent",
  description:
    "Critic pass on design.md + tasks/. Checks plan vs ARCHITECTURE.md.",
};
