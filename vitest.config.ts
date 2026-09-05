import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["plugins/**/*.mjs"],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
