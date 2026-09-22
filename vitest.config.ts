import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Route CJS `pg` to a test double so suites do not open a real pool.
      pg: path.resolve(__dirname, "./src/lib/__tests__/mocks/pg.ts"),
    },
  },
  test: {
    environment: "node",
    // vmForks evaluates modules as scripts, so suite collection fails
    // ("No test suite found" / Unexpected token 'export' on component imports).
    pool: "forks",
  },
});
