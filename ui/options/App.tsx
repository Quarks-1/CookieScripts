import { useCallback, useEffect, useState } from "react";

import {
  clearLinkHistory,
  getExtensionSettings,
  getLinkHistory,
  saveExtensionSettings,
} from "@ext/lib/messages.ts";
import type { ExtensionSettings, HistoryItem } from "@ext/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { LinkHistory } from "@shared/components/LinkHistory.tsx";
import { WatchTargetsForm } from "@shared/components/WatchTargetsForm.tsx";
import { useWatchTargetsEditor } from "@shared/hooks/useWatchTargetsEditor.ts";

type PageState = "loading" | "error" | "ready";

export default function App() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const handleSettingsRefreshed = useCallback((next: ExtensionSettings) => {
    setSettings(next);
    setEnabled(next.enabled);
  }, []);

  const editor = useWatchTargetsEditor(settings, enabled, handleSettingsRefreshed);

  async function loadSettings() {
    try {
      const next = await getExtensionSettings();
      setSettings(next);
      setEnabled(next.enabled);
      setPageState("ready");
      setPageError(null);
    } catch (error) {
      setPageState("error");
      setPageError(error instanceof Error ? error.message : "Failed to load settings");
    }
  }

  async function loadHistory() {
    try {
      const items = await getLinkHistory();
      setHistory(items);
    } catch {
      // history is non-critical on load failure
    }
  }

  useEffect(() => {
    void loadSettings();
    void loadHistory();
  }, []);

  async function handleEnabledChange(next: boolean) {
    if (!settings) {
      return;
    }
    setEnabling(true);
    setEnableError(null);
    const previous = enabled;
    setEnabled(next);
    try {
      await saveExtensionSettings({ ...settings, enabled: next });
      const refreshed = await getExtensionSettings();
      setSettings(refreshed);
      setEnabled(refreshed.enabled);
    } catch (error) {
      setEnabled(previous);
      setEnableError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setEnabling(false);
    }
  }

  async function handleClearHistory() {
    if (!window.confirm("Clear all link history? This cannot be undone.")) {
      return;
    }
    setClearingHistory(true);
    setClearMessage(null);
    try {
      await clearLinkHistory();
      setHistory([]);
      setClearMessage("History cleared");
    } catch (error) {
      setClearMessage(error instanceof Error ? error.message : "Failed to clear history");
    } finally {
      setClearingHistory(false);
    }
  }

  if (pageState === "loading") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-zinc-400">Loading settings…</p>
      </main>
    );
  }

  if (pageState === "error") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">CookieScripts — Settings</h1>
        <p className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">
          {pageError}
        </p>
        <button
          type="button"
          onClick={() => {
            setPageState("loading");
            void loadSettings();
          }}
          className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">CookieScripts — Settings</h1>

      <section aria-labelledby="enable-heading" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 id="enable-heading" className="text-lg font-semibold">
          Extension
        </h2>
        <div className="mt-3">
          <EnableSlider
            id="global-enabled"
            label="Enable link opening"
            checked={enabled}
            disabled={enabling || editor.savingTarget}
            onChange={(next) => void handleEnabledChange(next)}
          />
        </div>
        {enabling && <p className="mt-2 text-xs text-zinc-500">Saving…</p>}
        {enableError && (
          <p role="status" aria-live="polite" className="mt-2 text-sm text-red-300">
            {enableError}
          </p>
        )}
      </section>

      {editor.externalChange && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-200"
        >
          Settings changed elsewhere — save or reload this page to sync.
          <button
            type="button"
            onClick={() => settings && editor.reloadFromSettings(settings)}
            className="ml-2 underline"
          >
            Reload
          </button>
        </p>
      )}

      <WatchTargetsForm
        drafts={editor.drafts}
        disabled={editor.disabled || enabling}
        targetError={editor.targetError}
        targetSuccess={editor.targetSuccess}
        savingTarget={editor.savingTarget}
        onUpdateDraft={editor.updateDraft}
        onAddChannel={editor.addChannel}
        onRemoveChannel={editor.removeChannel}
        onSubmit={editor.handleTargetSave}
      />

      <section
        aria-labelledby="help-heading"
        className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400"
      >
        <h2 id="help-heading" className="text-lg font-semibold text-zinc-200">
          How to get a channel ID
        </h2>
        <p className="mt-2">
          Enable Developer Mode in Discord settings, then right-click the channel and choose{" "}
          <strong className="text-zinc-300">Copy Channel ID</strong>.
        </p>
        <p className="mt-2">
          Keep a Discord tab open on each channel you want monitored.
        </p>
      </section>

      <section aria-labelledby="history-heading" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="history-heading" className="text-lg font-semibold">
            Link history
          </h2>
          <button
            type="button"
            disabled={clearingHistory || history.length === 0}
            onClick={() => void handleClearHistory()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 disabled:opacity-50"
          >
            {clearingHistory ? "Clearing…" : "Clear history"}
          </button>
        </div>
        <div className="mt-4">
          <LinkHistory items={history} emptyMessage="No links opened yet." />
        </div>
        {clearMessage && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-zinc-400">
            {clearMessage}
          </p>
        )}
      </section>
    </main>
  );
}
