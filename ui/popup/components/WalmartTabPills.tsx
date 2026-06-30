import type { WalmartOpenTabSummary } from "@ext/types/walmart.ts";

interface WalmartTabPillsProps {
  openTabs: WalmartOpenTabSummary[];
}

function tooltipForTab(tab: WalmartOpenTabSummary): string {
  if (tab.title.trim()) {
    return `${tab.title}\n${tab.url}`;
  }
  return tab.url;
}

async function focusTab(tabId: number, windowId: number): Promise<void> {
  try {
    await chrome.windows.update(windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // Tab or window may have closed.
  }
}

export function WalmartTabPills({ openTabs }: WalmartTabPillsProps) {
  if (openTabs.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Open Walmart tabs">
      {openTabs.map((tab) => (
        <li key={tab.tabId}>
          <button
            type="button"
            title={tooltipForTab(tab)}
            aria-label={`Focus tab ${tab.tabId}: ${tab.label}`}
            onClick={() => void focusTab(tab.tabId, tab.windowId)}
            className={
              tab.isActive
                ? "inline-flex items-center gap-1.5 rounded-full border border-sky-600 bg-sky-950/40 px-2 py-1 text-xs text-sky-200"
                : "inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            }
          >
            {tab.isRecording && (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
            )}
            {tab.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
