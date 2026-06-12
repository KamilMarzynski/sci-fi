export const FIX_STATUS_VALUES = ['open', 'resolved', 'wont-fix'] as const;

export type FixStatus = (typeof FIX_STATUS_VALUES)[number];

export interface FixFrontmatter {
  id: string;
  slug: string;
  status: FixStatus;
  feature: string;
  created: string;
}
