import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-feature",
  kind: "user",
  description:
    "Start grilling session for new feature. Reads ARCHITECTURE.md. Asks to update it when work touches structure. Writes spec.md.",
  argumentHint: "[title]",
  disableModelInvocation: true,
};
