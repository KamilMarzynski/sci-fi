import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-implement",
  kind: "user",
  description:
    "Execute tasks from a plan. Prefers dispatching a subagent per task. Orchestrates.",
  argumentHint: "[spec-id]",
  disableModelInvocation: true,
};
