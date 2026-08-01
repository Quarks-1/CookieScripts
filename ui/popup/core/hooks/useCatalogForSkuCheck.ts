import { useCallback, useState } from "react";

import { loadCatalogForRuntime } from "@ext/core/lib/catalog/fetch-catalog.ts";
import type { CatalogData } from "@ext/core/types/index.ts";

export function useCatalogForSkuCheck() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<CatalogData | null> => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadCatalogForRuntime();
      setCatalog(next);
      if (!next) {
        setError("Could not load catalog");
      }
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load catalog";
      setError(message);
      setCatalog(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { catalog, loading, error, load };
}
