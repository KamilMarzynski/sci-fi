import { z } from 'zod';

const skillManifestSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('user'),
  description: z.string().min(1),
  allowedTools: z.array(z.string()).optional(),
  argumentHint: z.string().optional(),
  disableModelInvocation: z.boolean().optional(),
});

export { skillManifestSchema };
export type SkillManifest = z.infer<typeof skillManifestSchema>;

export interface SkillBundle {
  readonly manifest: SkillManifest;
  readonly body: string;
}
