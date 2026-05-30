import { z } from "zod";

const baseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  allowedTools: z.array(z.string()).optional(),
});

const userManifestSchema = baseSchema.extend({
  kind: z.literal("user"),
  argumentHint: z.string().optional(),
  disableModelInvocation: z.boolean().optional(),
});

const subagentManifestSchema = baseSchema.extend({
  kind: z.literal("subagent"),
  model: z.string().optional(),
});

export const skillManifestSchema = z.discriminatedUnion("kind", [
  userManifestSchema,
  subagentManifestSchema,
]);

export type SkillKind = z.infer<typeof skillManifestSchema>["kind"];
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type UserSkillManifest = z.infer<typeof userManifestSchema>;
export type SubagentSkillManifest = z.infer<typeof subagentManifestSchema>;

export interface SkillBundle {
  readonly manifest: SkillManifest;
  readonly body: string;
}
