import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-receiving-review",
  description:
    "How to act on a review (spec or code). Verify before implementing, fix by severity, push back with technical reasoning when the reviewer is wrong.",
};
