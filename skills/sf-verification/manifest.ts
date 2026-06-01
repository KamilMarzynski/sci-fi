import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-verification",
  kind: "user",
  description:
    "Verify implementation matches spec + plan. Runs user validations from EVALUATION.md.",
};
