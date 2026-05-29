import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-fix",
  kind: "user",
  description: "Open a fix for an existing spec/task.",
  argumentHint: "[task-ref]",
  disableModelInvocation: true,
};
