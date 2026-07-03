import type { HistoryItem } from "@ext/core/types/index.ts";

interface LinkHistoryProps {
  items: HistoryItem[];
  maxItems?: number;
  variant?: "compact" | "card";
  emptyMessage?: string;
}

function kindLabel(kind: HistoryItem["kind"]) {
  switch (kind) {
    case "opened":
      return "Opened";
    case "duplicate":
      return "Duplicate";
    case "keyword_skipped":
      return "Keyword skipped";
    case "retailer_window_opened":
      return "Target window";
    case "retailer_auto_queued":
      return "Target queued";
    case "retailer_auto_success":
      return "Target auto OK";
    case "retailer_auto_failed":
      return "Target auto failed";
  }
}

function kindTone(kind: HistoryItem["kind"]) {
  switch (kind) {
    case "opened":
    case "retailer_window_opened":
    case "retailer_auto_success":
      return "text-emerald-300";
    case "duplicate":
      return "text-amber-300";
    case "keyword_skipped":
      return "text-amber-300";
    case "retailer_auto_queued":
      return "text-amber-300";
    case "retailer_auto_failed":
      return "text-red-300";
  }
}

export function LinkHistory({
  items,
  maxItems,
  variant = "card",
  emptyMessage = "No links yet.",
}: LinkHistoryProps) {
  const displayItems = maxItems !== undefined ? items.slice(0, maxItems) : items;
  const isCompact = variant === "compact";

  if (displayItems.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ul className={isCompact ? "space-y-2" : "space-y-3"}>
      {displayItems.map((item, index) => (
        <li
          key={`${item.timestamp}-${item.url}-${index}`}
          className={
            isCompact
              ? "rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs"
              : "rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <span className={`font-medium ${kindTone(item.kind)}`}>{kindLabel(item.kind)}</span>
            <time className="text-xs text-zinc-500">
              {new Date(item.timestamp).toLocaleString()}
            </time>
          </div>
          <p className={`mt-1 break-all font-mono text-zinc-300 ${isCompact ? "text-xs" : ""}`}>
            {item.url}
          </p>
          <p className={`text-zinc-500 ${isCompact ? "text-xs" : "text-sm"}`}>
            channel {item.channel_id} · from {item.author}
          </p>
          {item.error && (
            <p className={`mt-1 text-red-300 ${isCompact ? "text-xs" : "text-sm"}`}>{item.error}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
