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
  id: string;
  slug: string;
  title?: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureMetadataInput {
  id: string;
  slug: string;
  title?: string;
  createdAt: string;
}
