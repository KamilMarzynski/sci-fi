import type { SkillManifest } from "specflow/skill-types";

export const manifest: SkillManifest = {
  id: "sf-change",
  description:
    "Change scope of an in-flight feature. Detects current step, loads spec/design, updates files, adds or removes tasks via CLI. Gate before resuming planning or implementation.",
  argumentHint: "[spec-id]",
};
