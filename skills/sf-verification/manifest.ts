import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-verification",
  kind: "subagent",
  description:
    "Verify implementation matches spec + plan. Runs user validations from EVALUATION.md.",
};
