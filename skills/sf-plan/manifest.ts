import type { SkillManifest } from "scifi/skill-types";

export const manifest: SkillManifest = {
  id: "sf-plan",
  description:
    "Deep technical planning from approved spec.md. Writes design.md + tasks/. Greps docs/scifi/adr/ for context; records an ADR for hard, non-obvious decisions.",
  argumentHint: "[feature-slug]",
};
