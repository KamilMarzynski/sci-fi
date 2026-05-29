import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-bug",
  kind: "user",
  description: "Create a bug report. Standalone or spec-nested via --task.",
  argumentHint: "[description]",
  disableModelInvocation: true,
};
