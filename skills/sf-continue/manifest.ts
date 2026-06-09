import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-continue",
  description:
    "Resume an interrupted feature. Reads `scifi status <slug> --json`, determines the next workflow step from lifecycle status, and runs the matching skill, pausing where human handoff is required.",
  argumentHint: "[slug]",
};
