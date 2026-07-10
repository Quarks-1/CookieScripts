import type { RetailerOpenTabSummary } from "@ext/core/types/index.ts";

interface TargetTabPillsProps {
  openTabs: RetailerOpenTabSummary[];
}

function tooltipForTab(tab: RetailerOpenTabSummary): string {
  if (tab.title.trim()) {
    return `${tab.title}\n${tab.url}`;
  }
  return tab.url;
}

/** Split disambiguated label into wrapped title + optional TCIN/tab suffix line. */
function splitPillLabel(label: string): { title: string; suffix?: string } {
  const tcinSuffix = label.match(/^(.*) · T(\d+)$/);
  if (tcinSuffix?.[1] != null && tcinSuffix[2] != null) {
    return { title: tcinSuffix[1].trimEnd(), suffix: `T${tcinSuffix[2]}` };
  }
  return { title: label };
}

async function focusTab(tabId: number, windowId: number): Promise<void> {
  try {
    await chrome.windows.update(windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // Tab or window may have closed.
  }
}

export function TargetTabPills({ openTabs }: TargetTabPillsProps) {
  if (openTabs.length === 0) {
    return null;
  }

  return (
    <ul
      className="mt-2 flex list-none flex-col gap-2 p-0"
      aria-label="Open Target tabs"
    >
      {openTabs.map((tab) => {
        const { title, suffix } = splitPillLabel(tab.label);
        return (
          <li key={tab.tabId} className="min-w-0 w-full">
            <button
              type="button"
              title={tooltipForTab(tab)}
              aria-label={`Focus tab ${tab.tabId}: ${tab.label}`}
              onClick={() => void focusTab(tab.tabId, tab.windowId)}
              className={
                tab.isActive
                  ? "flex w-full items-center gap-1.5 rounded-xl border border-sky-600 bg-sky-950/40 px-2.5 py-1.5 text-left text-xs text-sky-200"
                  : "flex w-full items-center gap-1.5 rounded-xl border border-zinc-700 px-2.5 py-1.5 text-left text-xs text-zinc-300"
              }
            >
              {tab.isRunning && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block whitespace-normal break-words">{title}</span>
                {suffix && (
                  <span
                    className={
                      tab.isActive
                        ? "mt-0.5 block text-[10px] text-sky-300"
                        : "mt-0.5 block text-[10px] text-zinc-400"
                    }
                  >
                    {suffix}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
