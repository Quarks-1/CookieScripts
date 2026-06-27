import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ext": path.resolve(__dirname, "extension"),
      "@shared": path.resolve(__dirname, "ui/shared"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
