import { useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/lib/messages.ts";
import { LinkHistory } from "@shared/components/LinkHistory.tsx";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { WatchStatusBadge } from "@shared/components/WatchStatusBadge.tsx";
import { usePopupStatus } from "./hooks/usePopupStatus.ts";

export default function App() {
  const { status, loading, error, refresh } = usePopupStatus();
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
      <h1 className="text-lg font-semibold">CookieScripts</h1>

      <section aria-labelledby="popup-enable-heading" className="mt-3">
        <h2 id="popup-enable-heading" className="sr-only">
          Extension enabled
        </h2>
        <EnableSlider
          id="popup-global-enabled"
          checked={status?.enabled ?? false}
          disabled={loading || enabling || status === null}
          onChange={(next) => void handleEnabledChange(next)}
        />
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
          <section aria-label="Watch status">
            <WatchStatusBadge status={status} />
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-zinc-500">Channel</dt>
                <dd className="font-mono text-zinc-300">{status.active_channel_id ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="recent-links-heading">
            <h2 id="recent-links-heading" className="text-sm font-medium text-zinc-400">
              Recent links
            </h2>
            <div className="mt-2">
              <LinkHistory
                items={status.recent_history}
                maxItems={10}
                variant="compact"
                emptyMessage="No links yet."
              />
            </div>
          </section>

          <button
            type="button"
            onClick={() => chrome.runtime.openOptionsPage()}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
          >
            Open settings
          </button>
        </div>
      )}
    </main>
  );
}
