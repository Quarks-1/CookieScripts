import { useEffect, useRef, useState } from "react";

import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import {
  WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  normalizeWalmartRefreshIntervalSec,
} from "@ext/domains/walmart/lib/auto-refresh.ts";
import { WALMART_THROTTLE_DEFAULT_INTERVAL_SEC } from "@ext/domains/walmart/lib/constants.ts";

function parseRefreshIntervalDraft(raw: string, fallback: number): number {
  if (raw.trim() === "") {
    return fallback;
  }
  return normalizeWalmartRefreshIntervalSec(raw);
}

interface WalmartAutoRefreshSectionProps {
  enabled: boolean;
  refreshIntervalSec: number;
  throttleRefreshIntervalSec: number;
  queuePassSoundEnabled: boolean;
  consolidateQueueTabsEnabled: boolean;
  disabled: boolean;
  savingRefresh: boolean;
  savingEnabled: boolean;
  savingQueueSettings: boolean;
  refreshError: string | null;
  enableError: string | null;
  queueSettingsError: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onRefreshIntervalChange: (intervalSec: number) => void;
  onThrottleRefreshIntervalChange: (intervalSec: number) => void;
  onQueuePassSoundChange: (enabled: boolean) => void;
  onConsolidateQueueTabsChange: (enabled: boolean) => void;
}

export function WalmartAutoRefreshSection({
  enabled,
  refreshIntervalSec,
  throttleRefreshIntervalSec,
  queuePassSoundEnabled,
  consolidateQueueTabsEnabled,
  disabled,
  savingRefresh,
  savingEnabled,
  savingQueueSettings,
  refreshError,
  enableError,
  queueSettingsError,
  onEnabledChange,
  onRefreshIntervalChange,
  onThrottleRefreshIntervalChange,
  onQueuePassSoundChange,
  onConsolidateQueueTabsChange,
}: WalmartAutoRefreshSectionProps) {
  const [draftInterval, setDraftInterval] = useState(() => String(refreshIntervalSec));
  const [draftThrottleInterval, setDraftThrottleInterval] = useState(() =>
    String(throttleRefreshIntervalSec),
  );
  const intervalFocusedRef = useRef(false);
  const throttleIntervalFocusedRef = useRef(false);
  const toggleDisabled = disabled || savingEnabled || savingRefresh || refreshIntervalSec < 1;
  const queueToggleDisabled = disabled || savingQueueSettings;

  useEffect(() => {
    if (!intervalFocusedRef.current) {
      setDraftInterval(String(refreshIntervalSec));
    }
  }, [refreshIntervalSec]);

  useEffect(() => {
    if (!throttleIntervalFocusedRef.current) {
      setDraftThrottleInterval(String(throttleRefreshIntervalSec));
    }
  }, [throttleRefreshIntervalSec]);

  const commitRefreshInterval = (): void => {
    intervalFocusedRef.current = false;
    const normalized = parseRefreshIntervalDraft(draftInterval, WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC);
    setDraftInterval(String(normalized));
    if (normalized !== refreshIntervalSec) {
      onRefreshIntervalChange(normalized);
    }
  };

  const commitThrottleInterval = (): void => {
    throttleIntervalFocusedRef.current = false;
    const normalized = parseRefreshIntervalDraft(
      draftThrottleInterval,
      WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
    );
    setDraftThrottleInterval(String(normalized));
    if (normalized !== throttleRefreshIntervalSec) {
      onThrottleRefreshIntervalChange(normalized);
    }
  };

  return (
    <section aria-labelledby="walmart-auto-refresh-heading" className="mt-2 space-y-2">
      <h2 id="walmart-auto-refresh-heading" className="sr-only">
        Walmart drop helpers
      </h2>
      <EnableSlider
        id="popup-walmart-queue-pass-sound"
        label="Queue pass sound"
        checked={queuePassSoundEnabled}
        disabled={queueToggleDisabled}
        onChange={onQueuePassSoundChange}
      />
      <EnableSlider
        id="popup-walmart-consolidate-queue-tabs"
        label="Consolidate queue tabs"
        checked={consolidateQueueTabsEnabled}
        disabled={queueToggleDisabled}
        onChange={onConsolidateQueueTabsChange}
      />
      {savingQueueSettings && <p className="text-xs text-zinc-500">Saving queue settings…</p>}
      {queueSettingsError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {queueSettingsError}
        </p>
      )}

      <label
        className="block text-xs text-zinc-500"
        htmlFor="popup-walmart-throttle-refresh-interval"
      >
        Throttle refresh interval (seconds)
      </label>
      <input
        id="popup-walmart-throttle-refresh-interval"
        type="number"
        min={1}
        max={3600}
        step={1}
        value={draftThrottleInterval}
        disabled={disabled || savingQueueSettings}
        onFocus={() => {
          throttleIntervalFocusedRef.current = true;
        }}
        onChange={(event) => setDraftThrottleInterval(event.target.value)}
        onBlur={commitThrottleInterval}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      />
      <p className="text-xs text-zinc-500">
        Hard-refresh throttle/hold pages on this interval (all Walmart tabs).
      </p>

      <EnableSlider
        id="popup-walmart-auto-refresh"
        label="Auto refresh"
        checked={enabled}
        disabled={toggleDisabled}
        onChange={onEnabledChange}
      />
      {refreshIntervalSec < 1 && !disabled && (
        <p className="text-xs text-zinc-500">Set interval to at least 1 second to enable.</p>
      )}
      {savingEnabled && <p className="text-xs text-zinc-500">Saving…</p>}
      {enableError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {enableError}
        </p>
      )}

      <label
        className="block text-xs text-zinc-500"
        htmlFor="popup-walmart-refresh-interval"
      >
        Hard refresh interval (seconds)
      </label>
      <input
        id="popup-walmart-refresh-interval"
        type="number"
        min={1}
        max={3600}
        step={1}
        value={draftInterval}
        disabled={disabled || savingRefresh}
        onFocus={() => {
          intervalFocusedRef.current = true;
        }}
        onChange={(event) => setDraftInterval(event.target.value)}
        onBlur={commitRefreshInterval}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      />
      <p className="text-xs text-zinc-500">Hard-refresh this Walmart tab on this interval.</p>
      {savingRefresh && <p className="text-xs text-zinc-500">Saving refresh interval…</p>}
      {refreshError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {refreshError}
        </p>
      )}
    </section>
  );
}
