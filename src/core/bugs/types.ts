export const BUG_STATUS_VALUES = ['open', 'in-progress', 'resolved', 'wont-fix'] as const;

export type BugStatus = (typeof BUG_STATUS_VALUES)[number];

export const BUG_SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;

export type BugSeverity = (typeof BUG_SEVERITY_VALUES)[number];

export interface BugFrontmatter {
  id: string;
  slug: string;
  status: BugStatus;
  severity?: BugSeverity;
  'related-feature'?: string;
  created: string;
}
