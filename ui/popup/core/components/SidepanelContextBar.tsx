import type { SidepanelTab } from "../sidepanel-tabs.ts";

const SEGMENTS: { id: SidepanelTab; label: string }[] = [
  { id: "discord", label: "Discord" },
  { id: "target", label: "Target" },
  { id: "walmart", label: "Walmart" },
  { id: "samsclub", label: "Sam's Club" },
  { id: "global", label: "Global" },
];

interface SidepanelContextBarProps {
  activeTab: SidepanelTab;
  onTabChange: (tab: SidepanelTab) => void;
}

export function SidepanelContextBar({ activeTab, onTabChange }: SidepanelContextBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Domain settings"
      className="mt-3 flex border-b border-zinc-800"
    >
      {SEGMENTS.map((segment) => {
        const isActive = segment.id === activeTab;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            id={`sidepanel-tab-${segment.id}`}
            aria-selected={isActive}
            aria-controls={`sidepanel-panel-${segment.id}`}
            onClick={() => onTabChange(segment.id)}
            className={`flex-1 border-b-2 pb-2 text-center text-sm transition-colors ${
              isActive
                ? "border-sky-500 font-medium text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
