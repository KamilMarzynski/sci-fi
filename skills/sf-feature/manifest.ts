import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-feature",
  description:
    "Start grilling session for new feature. Greps docs/scifi/adr/ for relevant decisions; records an ADR only for hard, non-obvious choices. Writes spec.md.",
  argumentHint: "[title]",
};
