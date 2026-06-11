import { join } from 'node:path';
import { createSkillBundleAdapter } from './skill-writer.js';

export const claudeCodeAdapter = createSkillBundleAdapter({
  id: 'claude-code',
  baseDir: join('.claude', 'skills'),
});
