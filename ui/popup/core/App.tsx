import { useEffect, useRef, useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import { GlobalSettingsSection } from "./components/GlobalSettingsSection.tsx";
import { SidepanelContextBar } from "./components/SidepanelContextBar.tsx";
import { SidepanelHeader } from "./components/SidepanelHeader.tsx";
import { usePopupStatus } from "./hooks/usePopupStatus.ts";
import { useUpdateCheck } from "./hooks/useUpdateCheck.ts";
import { DiscordPanel } from "./panels/DiscordPanel.tsx";
import { GlobalPanel } from "./panels/GlobalPanel.tsx";
import { TargetPanel } from "./panels/TargetPanel.tsx";
import { WalmartPanel } from "./panels/WalmartPanel.tsx";
import {
  resolveSidepanelTabForActiveTabChange,
  type SidepanelTab,
} from "./sidepanel-tabs.ts";
import type { ActiveTabKind } from "@ext/core/types/index.ts";

export default function App() {
  const { status, loading, error, refresh } = usePopupStatus();
  const updateCheck = useUpdateCheck();
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<SidepanelTab | null>(null);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef<SidepanelTab | null>(null);
  const prevActiveTabKindRef = useRef<ActiveTabKind | null>(null);

  useEffect(() => {
    if (status === null) {
      return;
    }
    const kind = status.active_tab_kind;
    const nextTab = resolveSidepanelTabForActiveTabChange(
      kind,
      prevActiveTabKindRef.current,
      selectedTab,
    );
    if (kind !== prevActiveTabKindRef.current) {
      prevActiveTabKindRef.current = kind;
    }
    if (nextTab !== null) {
      setSelectedTab(nextTab);
    }
  }, [status?.active_tab_kind, selectedTab]);

  useEffect(() => {
    if (selectedTab !== null && selectedTab !== prevTabRef.current) {
      panelScrollRef.current?.scrollTo(0, 0);
      prevTabRef.current = selectedTab;
    }
  }, [selectedTab]);

  async function handleEnabledChange(next: boolean) {
    setEnabling(true);
    setEnableError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings({ ...settings, enabled: next });
      await refresh();
    } catch (err) {
      setEnableError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEnabling(false);
    }
  }

  const panelDisabled = status ? !status.enabled || enabling : true;

  return (
    <main className="flex min-h-dvh w-full min-w-72 flex-col p-4">
      <div className="sticky top-0 z-10 shrink-0 bg-zinc-950 pb-2">
        <SidepanelHeader
          status={status}
          enabling={enabling}
          enableError={enableError}
          onEnabledChange={(next) => void handleEnabledChange(next)}
          updateCheck={updateCheck}
        />
        {status !== null && selectedTab !== null && (
          <>
            <GlobalSettingsSection status={status} disabled={enabling} onRefresh={refresh} />
            <SidepanelContextBar activeTab={selectedTab} onTabChange={setSelectedTab} />
          </>
        )}
      </div>

      {loading && <p className="mt-3 text-sm text-zinc-400">Loading…</p>}

      {error && (
        <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {status !== null && !loading && selectedTab !== null && (
        <div
          ref={panelScrollRef}
          role="tabpanel"
          id={`sidepanel-panel-${selectedTab}`}
          aria-labelledby={`sidepanel-tab-${selectedTab}`}
          className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto"
        >
          {selectedTab === "discord" && (
            <DiscordPanel status={status} disabled={panelDisabled} />
          )}
          {selectedTab === "target" && (
            <TargetPanel status={status} disabled={panelDisabled} onRefresh={refresh} />
          )}
          {selectedTab === "walmart" && (
            <WalmartPanel status={status} disabled={panelDisabled} onRefresh={refresh} />
          )}
          {selectedTab === "global" && (
            <GlobalPanel status={status} disabled={enabling} onRefresh={refresh} />
          )}
        </div>
      )}
    </main>
  );
}
