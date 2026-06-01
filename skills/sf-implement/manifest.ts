import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-implement",
  kind: "user",
  description:
    "Execute tasks from a plan. Orchestrates task execution.",
  argumentHint: "[spec-id]",
  disableModelInvocation: true,
};
