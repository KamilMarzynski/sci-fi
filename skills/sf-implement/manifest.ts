import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-implement",
  description:
    "Orchestrate implementation of a plan-ready feature. Dispatches one TDD subagent per task in dependency order, gates each on code review, then runs final review + verification.",
  argumentHint: "[spec-id]",
};
