import { claudeCodeAdapter } from './claude-code.js';
import { otherAdapters } from './other-harnesses.js';
import { registerAdapter } from './registry.js';

registerAdapter(claudeCodeAdapter);
for (const adapter of otherAdapters) {
  registerAdapter(adapter);
}
