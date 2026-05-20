export const TASK_STATUS_VALUES = [
  "pending",
  "in-progress",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export interface TaskFrontmatter {
  id: string;
  slug: string;
  status: TaskStatus;
  parallel: boolean;
  dependsOn: string[];
}
