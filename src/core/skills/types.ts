export type SkillKind = "user" | "subagent";

export interface SkillManifest {
  readonly id: string;
  readonly kind: SkillKind;
  readonly description: string;
  readonly argumentHint?: string;
  readonly allowedTools?: readonly string[];
  readonly disableModelInvocation?: boolean;
  readonly model?: string;
}

export interface SkillBundle {
  readonly manifest: SkillManifest;
  readonly body: string;
}
