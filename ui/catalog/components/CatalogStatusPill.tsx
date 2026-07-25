import type { CatalogLoadSource } from "@ext/core/lib/catalog/fetch-catalog.ts";

interface CatalogStatusPillProps {
  loading: boolean;
  error: string | null;
  source: CatalogLoadSource | null;
}

const SOURCE_CONFIG: Record<
  CatalogLoadSource,
  { tone: string; dot: string; label: string; ariaLabel: string }
> = {
  remote: {
    tone: "border-emerald-800/60 bg-emerald-950/40 text-emerald-200",
    dot: "bg-emerald-400",
    label: "Live",
    ariaLabel: "Catalog synced from GitHub",
  },
  cache: {
    tone: "border-amber-700/60 bg-amber-950/50 text-amber-200",
    dot: "bg-amber-400",
    label: "Cached",
    ariaLabel: "Using cached catalog",
  },
  bundled: {
    tone: "border-amber-700/60 bg-amber-950/50 text-amber-200",
    dot: "bg-amber-400",
    label: "Bundled",
    ariaLabel: "Using bundled catalog",
  },
};

export function CatalogStatusPill({ loading, error, source }: CatalogStatusPillProps) {
  if (loading) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2 py-0.5 text-xs font-medium text-zinc-300 opacity-70"
        role="status"
        aria-live="polite"
        aria-label="Fetching catalog"
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Fetching
      </span>
    );
  }

  if (error) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-800/60 bg-red-950/40 px-2 py-0.5 text-xs font-medium text-red-200"
        role="status"
        aria-live="polite"
        aria-label={`Catalog unavailable: ${error}`}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Unavailable
      </span>
    );
  }

  if (!source) {
    return null;
  }

  const config = SOURCE_CONFIG[source];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${config.tone}`}
      role="status"
      aria-live="polite"
      aria-label={config.ariaLabel}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
