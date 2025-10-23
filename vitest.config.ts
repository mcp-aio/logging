import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "lcov", "cobertura"],
      include: ["src/**/*.{ts,tsx,js,jsx}"],
      exclude: ["src/index.ts"],
    },
  },
});
