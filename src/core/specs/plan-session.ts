import { ScifiError } from '../output/errors.js';
import { inspectFeatureLifecycle } from './lifecycle.js';
import type { FeatureStatus } from './types.js';

/**
 * Where a feature sits relative to its planning session.
 *
 * - `ready-to-plan`  — spec-ready, no design/tasks written yet (start fresh).
 * - `in-progress`    — spec-ready with partial design/tasks (resume).
 * - `already-planned`— plan-ready or beyond (offer continue vs restart).
 */
export type PlanSessionState = 'ready-to-plan' | 'in-progress' | 'already-planned';

export interface PlanSession {
  slug: string;
  title?: string;
  status: FeatureStatus;
  state: PlanSessionState;
  designExists: boolean;
  taskFileCount: number;
}

export async function inspectPlanSession(projectRoot: string, slug: string): Promise<PlanSession> {
  const { metadata, artifacts } = await inspectFeatureLifecycle(projectRoot, slug);

  if (metadata.status === 'created') {
    throw new ScifiError(
      'PRECONDITION_FAILED',
      `Cannot plan "${slug}": feature is not spec-ready yet.`,
      { hint: `Finish the spec and run \`scifi spec-ready ${slug}\` first.` },
    );
  }

  let state: PlanSessionState;
  if (metadata.status === 'spec-ready') {
    state = artifacts.designExists || artifacts.taskFileCount > 0 ? 'in-progress' : 'ready-to-plan';
  } else {
    state = 'already-planned';
  }

  return {
    slug: metadata.slug,
    ...(metadata.title !== undefined && { title: metadata.title }),
    status: metadata.status,
    state,
    designExists: artifacts.designExists,
    taskFileCount: artifacts.taskFileCount,
  };
}
