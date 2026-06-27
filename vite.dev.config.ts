import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Dev-only Vite config — previews popup in a normal browser with mocked chrome APIs. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@ext": path.resolve(__dirname, "extension"),
      "@shared": path.resolve(__dirname, "ui/shared"),
      "@dev": path.resolve(__dirname, "ui/dev"),
    },
  },
  server: {
    open: "/ui/dev/popup.html",
  },
  build: {
    outDir: "dist-dev-ui",
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "ui/dev/popup.html"),
      },
    },
  },
});
