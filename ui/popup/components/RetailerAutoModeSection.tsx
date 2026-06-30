import { useEffect, useRef, useState } from "react";

import { EnableSlider } from "@shared/components/EnableSlider.tsx";

function parseRefreshIntervalDraft(raw: string): number {
  if (raw.trim() === "") {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(3600, Math.floor(parsed)));
}

interface RetailerAutoModeSectionProps {
  retailerAutoEnabled: boolean;
  refreshIntervalSec: number;
  manualStatus: string;
  manualRunning: boolean;
  showDiscordAutoToggle: boolean;
  disabled: boolean;
  refreshDisabled: boolean;
  saving: boolean;
  saveError: string | null;
  savingRefresh: boolean;
  refreshError: string | null;
  acting: boolean;
  actionError: string | null;
  autoStartBlocked: boolean;
  purchaseLimit: number | null;
  onChange: (enabled: boolean) => void;
  onRefreshIntervalChange: (intervalSec: number) => void;
  onStartManual: () => void;
  onStopManual: () => void;
}

export function RetailerAutoModeSection({
  retailerAutoEnabled,
  refreshIntervalSec,
  manualStatus,
  manualRunning,
  showDiscordAutoToggle,
  disabled,
  refreshDisabled,
  saving,
  saveError,
  savingRefresh,
  refreshError,
  acting,
  actionError,
  autoStartBlocked,
  purchaseLimit,
  onChange,
  onRefreshIntervalChange,
  onStartManual,
  onStopManual,
}: RetailerAutoModeSectionProps) {
  const controlsDisabled = acting || savingRefresh;
  const [draftInterval, setDraftInterval] = useState(() => String(refreshIntervalSec));
  const intervalFocusedRef = useRef(false);

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
    <section aria-labelledby="retailer-auto-heading">
      <h2 id="retailer-auto-heading" className="text-sm font-medium text-zinc-400">
        Target Auto Mode
      </h2>
      <div className="mt-2">
        {showDiscordAutoToggle && (
          <>
            <EnableSlider
              id="popup-retailer-auto-enabled"
              label="Auto-open from Discord"
              checked={retailerAutoEnabled}
              disabled={disabled || saving || autoStartBlocked}
              onChange={onChange}
            />
            <p className="mt-2 text-xs text-zinc-500">
              Opens Target links in a new window, adds to cart, then goes to checkout start.
            </p>
            {autoStartBlocked && purchaseLimit != null && (
              <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
                Quantity cannot exceed max ({purchaseLimit})
              </p>
            )}
          </>
        )}

        {manualStatus && (
          <p className="mt-2 text-xs text-zinc-400" role="status" aria-live="polite">
            {manualStatus}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={controlsDisabled || manualRunning || autoStartBlocked}
            onClick={onStartManual}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
          >
            {acting && !manualRunning ? "Starting…" : "Start Auto Mode"}
          </button>
          <button
            type="button"
            disabled={controlsDisabled || !manualRunning}
            onClick={onStopManual}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
          >
            {acting && manualRunning ? "Stopping…" : "Stop Auto Mode"}
          </button>
        </div>

        <label className="mt-3 block text-xs text-zinc-500" htmlFor="popup-retailer-refresh-interval">
          Hard refresh interval (seconds, 0 = off)
        </label>
        <input
          id="popup-retailer-refresh-interval"
          type="number"
          min={0}
          max={3600}
          step={1}
          value={draftInterval}
          disabled={refreshDisabled}
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
        <p className="mt-1 text-xs text-zinc-500">
          While the main Add to cart button is disabled, hard-refresh the page on this interval until
          it becomes available.
        </p>

        {saving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {savingRefresh && <p className="mt-1 text-xs text-zinc-500">Saving refresh interval…</p>}
        {saveError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {saveError}
          </p>
        )}
        {refreshError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {refreshError}
          </p>
        )}
        {actionError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {actionError}
          </p>
        )}
      </div>
    </section>
  );
}
