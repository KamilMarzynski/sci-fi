import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-bug",
  description: "Create a bug report. Standalone or spec-nested via --task.",
  argumentHint: "[description]",
};
