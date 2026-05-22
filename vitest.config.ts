import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/.claude/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["dist/**"],
      thresholds: {
        statements: 80,
        branches: 64,
        functions: 88,
        lines: 80,
      },
    },
  },
});
