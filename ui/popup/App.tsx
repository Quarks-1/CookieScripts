import { useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/lib/messages.ts";
import { LinkHistory } from "@shared/components/LinkHistory.tsx";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { WatchStatusBadge } from "@shared/components/WatchStatusBadge.tsx";
import { ChannelDomainsSection } from "./components/ChannelDomainsSection.tsx";
import { VersionStatus } from "./components/VersionStatus.tsx";
import { useChannelDomainsEditor } from "./hooks/useChannelDomainsEditor.ts";
import { useLinkHistory } from "./hooks/useLinkHistory.ts";
import { usePopupStatus } from "./hooks/usePopupStatus.ts";
import { useUpdateCheck } from "./hooks/useUpdateCheck.ts";

export default function App() {
  const { status, loading, error, refresh } = usePopupStatus();
  const domainsEditor = useChannelDomainsEditor(
    status?.active_channel_id ?? null,
    status?.enabled ?? false,
  );
  const linkHistory = useLinkHistory();
  const updateCheck = useUpdateCheck();
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

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

  return (
    <main className="w-80 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">CookieScripts</h1>
        <VersionStatus
          installedVersion={updateCheck.installedVersion}
          checking={updateCheck.checking}
          updateAvailable={updateCheck.updateAvailable}
          releaseUrl={updateCheck.releaseUrl}
        />
      </div>

      <section aria-labelledby="popup-enable-heading" className="mt-3">
        <h2 id="popup-enable-heading" className="sr-only">
          Extension enabled
        </h2>
        {status !== null ? (
          <EnableSlider
            id="popup-global-enabled"
            checked={status.enabled}
            disabled={enabling}
            onChange={(next) => void handleEnabledChange(next)}
          />
        ) : (
          <label className="flex cursor-wait items-center justify-between gap-3 text-sm opacity-60">
            <span className="text-zinc-300">Enable extension</span>
            <span
              aria-hidden="true"
              className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-zinc-800"
            />
          </label>
        )}
        {enabling && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {enableError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {enableError}
          </p>
        )}
      </section>

      {loading && <p className="mt-3 text-sm text-zinc-400">Loading…</p>}

      {error && (
        <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {status && !loading && (
        <div className="mt-4 space-y-4">
          <section aria-label="Status">
            <WatchStatusBadge status={status} />
          </section>

          <ChannelDomainsSection
            channelId={status.active_channel_id}
            domains={domainsEditor.domains}
            disabled={domainsEditor.disabled || enabling}
            saving={domainsEditor.saving}
            saveError={domainsEditor.saveError}
            onDomainsChange={domainsEditor.handleDomainsChange}
          />

          <section aria-labelledby="link-history-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="link-history-heading" className="text-sm font-medium text-zinc-400">
                Link history
              </h2>
              <button
                type="button"
                disabled={linkHistory.clearing || linkHistory.history.length === 0}
                onClick={() => void linkHistory.handleClearHistory()}
                className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
              >
                {linkHistory.clearing ? "Clearing…" : "Clear"}
              </button>
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto">
              {linkHistory.loading ? (
                <p className="text-sm text-zinc-500">Loading history…</p>
              ) : (
                <LinkHistory
                  items={linkHistory.history}
                  variant="compact"
                  emptyMessage="No links opened yet."
                />
              )}
            </div>
            {linkHistory.clearMessage && (
              <p role="status" aria-live="polite" className="mt-2 text-xs text-zinc-500">
                {linkHistory.clearMessage}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
