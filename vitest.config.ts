import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts"],
    },
    env: {
      NODE_ENV: "development",
    },
  },
});
