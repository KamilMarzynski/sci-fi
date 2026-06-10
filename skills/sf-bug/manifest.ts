import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-bug",
  description:
    "Investigate one bug with the user, agree on a solution, then fix it test-first under review. No spec or tracked artifact.",
  argumentHint: "[description]",
};
