import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-handover",
  description:
    "Final implementation subagent. Verifies the completed feature against spec + design and runs a quality check before handover. Aware of the optional HANDOVER.md finishing actions the orchestrator runs.",
};
