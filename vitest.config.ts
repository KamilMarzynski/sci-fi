import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.claude/**',
            'tests/e2e/**',
            'tests/cli/index.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts', 'tests/cli/index.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
          testTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['dist/**'],
      thresholds: {
        statements: 80,
        branches: 64,
        functions: 88,
        lines: 80,
      },
    },
  },
});
