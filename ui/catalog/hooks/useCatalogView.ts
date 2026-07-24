import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
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
        groupBy: persisted?.groupBy === "type" ? "type" : "set",
      });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
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
