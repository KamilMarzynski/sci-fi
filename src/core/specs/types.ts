export const FEATURE_STATUS_VALUES = [
  'created',
  'spec-ready',
  'plan-ready',
  'in-progress',
  'done',
] as const;

export type FeatureStatus = (typeof FEATURE_STATUS_VALUES)[number];

export interface FeatureMetadata {
  version: 1;
  slug: string;
  title?: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
  branch?: string;
  worktreePath?: string;
}

export interface CreateFeatureMetadataInput {
  slug: string;
  title?: string;
  createdAt: string;
}

export interface FeatureListItem {
  metadata: FeatureMetadata;
  location: 'local' | `worktree:${string}`;
}
