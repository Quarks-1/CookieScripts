import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import catalogJson from "@ext/core/data/catalog.json";
import { parseCatalog } from "@ext/core/lib/catalog/index.ts";
import "@shared/index.css";

import App from "./App.tsx";

document.title = "CookieScripts — SKU catalog";

const root = document.getElementById("root")!;

let catalog;
let parseError: string | null = null;
try {
  catalog = parseCatalog(catalogJson);
} catch (error) {
  parseError = error instanceof Error ? error.message : "Invalid catalog";
}

createRoot(root).render(
  <StrictMode>
    {parseError || !catalog ? (
      <main className="mx-auto max-w-5xl p-4">
        <p role="status" className="text-sm text-red-300">
          {parseError ?? "Invalid catalog"}
        </p>
      </main>
    ) : (
      <App catalog={catalog} />
    )}
  </StrictMode>,
);
