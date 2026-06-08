import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-fix",
  description: "Open a fix for an existing spec/task.",
  argumentHint: "[task-ref]",
};
