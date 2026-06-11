import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-code-review",
  description:
    "Read-only critic pass on one change: a feature task against design.md + the task's acceptance, or a bug/fix against the agreed solution. Returns a verdict that gates acceptance.",
};
