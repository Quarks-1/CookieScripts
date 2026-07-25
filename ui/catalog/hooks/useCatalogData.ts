import { useEffect, useState } from "react";

import {
  resolveCatalog,
  type CatalogLoadSource,
} from "@ext/core/lib/catalog/fetch-catalog.ts";
import type { CatalogData } from "@ext/core/types/index.ts";

export function useCatalogData(bundledRaw: unknown) {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [source, setSource] = useState<CatalogLoadSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void resolveCatalog(bundledRaw)
      .then((result) => {
        if (!cancelled) {
          setCatalog(result.catalog);
          setSource(result.source);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Invalid catalog");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bundledRaw]);

  return { catalog, loading, error, source };
}
