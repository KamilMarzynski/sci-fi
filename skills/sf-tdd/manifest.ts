import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-tdd",
  kind: "user",
  description:
    "Enforce tests-first discipline. Writes failing test before implementation per task.",
};
