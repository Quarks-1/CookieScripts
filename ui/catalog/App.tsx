import { useEffect, useMemo, useState } from "react";

import { buildSetIndexFromCatalog, groupCatalog } from "@ext/core/lib/catalog/index.ts";
import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { getExtensionSettings } from "@ext/core/lib/messages.ts";
import type { CatalogLoadSource } from "@ext/core/lib/catalog/fetch-catalog.ts";
import type { CatalogData, ExtensionSettings } from "@ext/core/types/index.ts";

import { CatalogFilters } from "./components/CatalogFilters.tsx";
import { CatalogGroupSection } from "./components/CatalogGroupSection.tsx";
import { CatalogHeader } from "./components/CatalogHeader.tsx";
import { useCatalogSelection } from "./hooks/useCatalogSelection.ts";
import { useCatalogView } from "./hooks/useCatalogView.ts";

type CatalogAppProps = {
  catalog: CatalogData;
  catalogLoading: boolean;
  catalogError: string | null;
  catalogSource: CatalogLoadSource | null;
};

export default function App({
  catalog,
  catalogLoading,
  catalogError,
  catalogSource,
}: CatalogAppProps) {
  const { view, loaded, setGroupBy, setRetailerFilter, setQuery, setSelectedOnly } =
    useCatalogView();
  const {
    targetSkus,
    walmartSkus,
    selectedSets,
    saving,
    saveError,
    overflowMessage,
    toggleFirstParty,
    toggleMarketplace,
    selectAllInGroup,
    clearGroup,
    clearAll,
  } = useCatalogSelection();
  const [skuOpenModeEnabled, setSkuOpenModeEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let storageChanged = false;
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[STORAGE_KEYS.settings]) {
        return;
      }
      storageChanged = true;
      const settings = changes[STORAGE_KEYS.settings].newValue as
        | ExtensionSettings
        | undefined;
      setSkuOpenModeEnabled(settings?.sku_open_mode_enabled ?? false);
    };

    chrome.storage.onChanged.addListener(onChanged);
    void getExtensionSettings().then((settings) => {
      if (!cancelled && !storageChanged) {
        setSkuOpenModeEnabled(settings.sku_open_mode_enabled ?? false);
      }
    });
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const setIndex = useMemo(() => buildSetIndexFromCatalog(catalog), [catalog]);

  const groups = useMemo(() => {
    if (!loaded) {
      return [];
    }
    return groupCatalog(catalog, view, selectedSets);
  }, [catalog, loaded, selectedSets, view]);

  return (
    <div className="space-y-4">
      <CatalogHeader
        view={view}
        targetCount={targetSkus.length}
        walmartCount={walmartSkus.length}
        skuOpenModeEnabled={skuOpenModeEnabled}
        saving={saving}
        saveError={saveError}
        overflowMessage={overflowMessage}
        catalogLoading={catalogLoading}
        catalogError={catalogError}
        catalogSource={catalogSource}
        onGroupByChange={setGroupBy}
        onRetailerFilterChange={setRetailerFilter}
        onSkuOpenModeChange={setSkuOpenModeEnabled}
        onClearAll={clearAll}
      />

      <CatalogFilters
        query={view.query ?? ""}
        selectedOnly={view.selectedOnly ?? false}
        disabled={saving}
        onQueryChange={setQuery}
        onSelectedOnlyChange={setSelectedOnly}
      />

      {groups.length === 0 ? (
        <p role="status" className="text-sm text-zinc-400">
          No products match
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <CatalogGroupSection
              key={group.id}
              group={group}
              setIndex={setIndex}
              selectedSets={selectedSets}
              activeQuery={view.query ?? ""}
              disabled={saving}
              onSelectAll={(retailer) => selectAllInGroup(group, retailer)}
              onClearGroup={(retailer) => clearGroup(group, retailer)}
              onToggleFirstParty={(retailer, _rowId, cell) => toggleFirstParty(retailer, cell)}
              onToggleMarketplace={(retailer, sku) => toggleMarketplace(retailer, sku)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
