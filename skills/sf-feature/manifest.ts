import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-feature",
  description:
    "Start grilling session for new feature. Reads ARCHITECTURE.md. Asks to update it when work touches structure. Writes spec.md.",
  argumentHint: "[title]",
};
