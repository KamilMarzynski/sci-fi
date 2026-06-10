import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-fix",
  description:
    "Fix a defect in an existing feature: diagnose against its spec/design with the user, agree on a solution, then fix it test-first under review and record a tracked fix.",
  argumentHint: "[feature-slug | description]",
};
