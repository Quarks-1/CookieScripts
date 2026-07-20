import type { SamsclubOpenTabSummary } from "@ext/core/types/index.ts";

interface SamsclubTabPillsProps {
  openTabs: SamsclubOpenTabSummary[];
}

type SamsclubTabPill = SamsclubOpenTabSummary & { isRunning?: boolean };

function tooltipForTab(tab: SamsclubOpenTabSummary): string {
  if (tab.title.trim()) {
    return `${tab.title}\n${tab.url}`;
  }
  return tab.url;
}

/** Split disambiguated label into wrapped title + optional suffix line. */
function splitPillLabel(label: string): { title: string; suffix?: string } {
  const itemSuffix = label.match(/^(.*) · (\d+)$/);
  if (itemSuffix?.[1] != null && itemSuffix[2] != null) {
    return { title: itemSuffix[1].trimEnd(), suffix: itemSuffix[2] };
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

function isTabRunning(tab: SamsclubTabPill): boolean {
  return tab.isRunning === true;
}

export function SamsclubTabPills({ openTabs }: SamsclubTabPillsProps) {
  if (openTabs.length === 0) {
    return null;
  }

  return (
    <ul
      className="mt-2 flex list-none flex-col gap-2 p-0"
      aria-label="Open Sam's Club tabs"
    >
      {(openTabs as SamsclubTabPill[]).map((tab) => {
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
              {(isTabRunning(tab) || tab.isRecording) && (
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
