import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // CJS `pg` is not reliably mocked under pool: "vmForks"; route to a test double.
      pg: path.resolve(__dirname, "./src/lib/__tests__/mocks/pg.ts"),
    },
  },
  test: {
    environment: "node",
    // Vite 8's default module runner breaks suite collection on Windows with
    // forks/threads ("Cannot read properties of undefined (reading 'config')").
    pool: "vmForks",
  },
});
