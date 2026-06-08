import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-plan",
  description:
    "Deep technical planning from approved spec.md. Writes design.md + tasks/. Reads ARCHITECTURE.md, asks to update if needed.",
  argumentHint: "[spec-id]",
};
