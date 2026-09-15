import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "threads",
    maxWorkers: 4,
    fileParallelism: false,
    include: ["tests/performance/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.git/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@omniroute/open-sse": path.resolve(__dirname, "./open-sse"),
    },
  },
});
