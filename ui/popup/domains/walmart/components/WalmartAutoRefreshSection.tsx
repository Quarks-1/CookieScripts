import { useEffect, useRef, useState } from "react";

import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import {
  WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC,
  normalizeWalmartRefreshIntervalSec,
} from "@ext/domains/walmart/lib/auto-refresh.ts";

function parseRefreshIntervalDraft(raw: string): number {
  if (raw.trim() === "") {
    return WALMART_AUTO_REFRESH_DEFAULT_INTERVAL_SEC;
  }
  return normalizeWalmartRefreshIntervalSec(raw);
}

interface WalmartAutoRefreshSectionProps {
  enabled: boolean;
  refreshIntervalSec: number;
  disabled: boolean;
  savingRefresh: boolean;
  savingEnabled: boolean;
  refreshError: string | null;
  enableError: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onRefreshIntervalChange: (intervalSec: number) => void;
}

export function WalmartAutoRefreshSection({
  enabled,
  refreshIntervalSec,
  disabled,
  savingRefresh,
  savingEnabled,
  refreshError,
  enableError,
  onEnabledChange,
  onRefreshIntervalChange,
}: WalmartAutoRefreshSectionProps) {
  const [draftInterval, setDraftInterval] = useState(() => String(refreshIntervalSec));
  const intervalFocusedRef = useRef(false);
  const toggleDisabled = disabled || savingEnabled || savingRefresh || refreshIntervalSec < 1;

  useEffect(() => {
    if (!intervalFocusedRef.current) {
      setDraftInterval(String(refreshIntervalSec));
    }
  }, [refreshIntervalSec]);

  const commitRefreshInterval = (): void => {
    intervalFocusedRef.current = false;
    const normalized = parseRefreshIntervalDraft(draftInterval);
    setDraftInterval(String(normalized));
    if (normalized !== refreshIntervalSec) {
      onRefreshIntervalChange(normalized);
    }
  };

  return (
    <section aria-labelledby="walmart-auto-refresh-heading" className="mt-2">
      <h2 id="walmart-auto-refresh-heading" className="sr-only">
        Walmart auto refresh
      </h2>
      <EnableSlider
        id="popup-walmart-auto-refresh"
        label="Auto refresh"
        checked={enabled}
        disabled={toggleDisabled}
        onChange={onEnabledChange}
      />
      {refreshIntervalSec < 1 && !disabled && (
        <p className="mt-1 text-xs text-zinc-500">Set interval to at least 1 second to enable.</p>
      )}
      {savingEnabled && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
      {enableError && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
          {enableError}
        </p>
      )}

      <label
        className="mt-3 block text-xs text-zinc-500"
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
        className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      />
      <p className="mt-1 text-xs text-zinc-500">Hard-refresh this Walmart tab on this interval.</p>
      {savingRefresh && <p className="mt-1 text-xs text-zinc-500">Saving refresh interval…</p>}
      {refreshError && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
          {refreshError}
        </p>
      )}
    </section>
  );
}
