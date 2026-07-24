import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  test: {
    environment: "node",
    pool: "forks",
    // Vitest 4.1 + Vite 8 can fail suite collection if the Vite module runner
    // never attaches a runner context (describe → runner.config throws).
    experimental: {
      viteModuleRunner: false,
    },
  },
});
