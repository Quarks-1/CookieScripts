import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import catalogJson from "@ext/core/data/catalog.json";
import "@shared/index.css";

import App from "./App.tsx";
import { CatalogHeader } from "./components/CatalogHeader.tsx";
import { useCatalogData } from "./hooks/useCatalogData.ts";

document.title = "CookieScripts — SKU catalog";

function CatalogRoot() {
  const { catalog, loading, error, source } = useCatalogData(catalogJson);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      {loading ? (
        <CatalogHeader
          view={{ groupBy: "set", retailerFilter: "all" }}
          targetCount={0}
          walmartCount={0}
          skuOpenModeEnabled={false}
          saving={false}
          saveError={null}
          overflowMessage={null}
          catalogLoading
          catalogError={null}
          catalogSource={null}
          onGroupByChange={() => {}}
          onRetailerFilterChange={() => {}}
          onSkuOpenModeChange={() => {}}
          onClearAll={() => {}}
        />
      ) : error || !catalog ? (
        <>
          <CatalogHeader
            view={{ groupBy: "set", retailerFilter: "all" }}
            targetCount={0}
            walmartCount={0}
            skuOpenModeEnabled={false}
            saving={false}
            saveError={null}
            overflowMessage={null}
            catalogLoading={false}
            catalogError={error}
            catalogSource={null}
            onGroupByChange={() => {}}
            onRetailerFilterChange={() => {}}
            onSkuOpenModeChange={() => {}}
            onClearAll={() => {}}
          />
          <p role="status" className="text-sm text-red-300">
            {error ?? "Invalid catalog"}
          </p>
        </>
      ) : (
        <App
          catalog={catalog}
          catalogLoading={false}
          catalogError={null}
          catalogSource={source}
        />
      )}
    </main>
  );
}

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <CatalogRoot />
  </StrictMode>,
);
