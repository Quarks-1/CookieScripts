import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { normalizeCatalogViewGroupBy } from "@ext/core/lib/settings-transfer.ts";
import type { CatalogView, CatalogViewPersisted } from "@ext/core/types/index.ts";

const DEFAULT_VIEW: CatalogView = {
  groupBy: "set",
  retailerFilter: "all",
  query: "",
  selectedOnly: false,
};

export function useCatalogView() {
  const [view, setView] = useState<CatalogView>(DEFAULT_VIEW);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void chrome.storage.local.get(STORAGE_KEYS.catalogView).then((result) => {
      if (cancelled) {
        return;
      }
      const persisted = result[STORAGE_KEYS.catalogView] as CatalogViewPersisted | undefined;
      setView({
        ...DEFAULT_VIEW,
        groupBy: normalizeCatalogViewGroupBy(persisted),
      });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== "local" || !changes[STORAGE_KEYS.catalogView]) {
        return;
      }
      const persisted = changes[STORAGE_KEYS.catalogView].newValue as
        | CatalogViewPersisted
        | undefined;
      setView((current) => ({
        ...current,
        groupBy: normalizeCatalogViewGroupBy(persisted),
      }));
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const setGroupBy = useCallback((groupBy: CatalogView["groupBy"]) => {
    setView((current) => ({ ...current, groupBy }));
    void chrome.storage.local.set({
      [STORAGE_KEYS.catalogView]: { groupBy } satisfies CatalogViewPersisted,
    });
  }, []);

  const setRetailerFilter = useCallback((retailerFilter: CatalogView["retailerFilter"]) => {
    setView((current) => ({ ...current, retailerFilter }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setView((current) => ({ ...current, query }));
  }, []);

  const setSelectedOnly = useCallback((selectedOnly: boolean) => {
    setView((current) => ({ ...current, selectedOnly }));
  }, []);

  return {
    view,
    loaded,
    setGroupBy,
    setRetailerFilter,
    setQuery,
    setSelectedOnly,
  };
}
