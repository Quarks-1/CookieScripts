import type { HistoryItem } from "@ext/types/index.ts";

interface LinkHistoryProps {
  items: HistoryItem[];
  maxItems?: number;
  variant?: "compact" | "card";
  emptyMessage?: string;
}

function kindLabel(kind: HistoryItem["kind"]) {
  return kind === "opened" ? "Opened" : "Duplicate";
}

function kindTone(kind: HistoryItem["kind"]) {
  return kind === "opened" ? "text-emerald-300" : "text-amber-300";
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
        </li>
      ))}
    </ul>
  );
}
