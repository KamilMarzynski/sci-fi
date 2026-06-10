import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-change",
  description:
    "Absorb a scope change to an existing feature: scope it against spec/design, reset lifecycle status to the deepest artifact it invalidates, and re-enter the pipeline so the right review gate runs again.",
  argumentHint: "[feature-slug | description]",
};
