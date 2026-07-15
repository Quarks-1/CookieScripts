import { useEffect, useRef, useState } from "react";

import type { RetailerOpenTabSummary } from "@ext/core/types/index.ts";
import { CompactNumberField } from "@shared/components/CompactNumberField.tsx";

import { TargetTabPills } from "./TargetTabPills.tsx";

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
  openTabs: RetailerOpenTabSummary[];
  showControls: boolean;
  refreshIntervalSec: number;
  manualStatus: string;
  manualRunning: boolean;
  refreshDisabled: boolean;
  savingRefresh: boolean;
  refreshError: string | null;
  acting: boolean;
  actionError: string | null;
  autoStartBlocked: boolean;
  purchaseLimit: number | null;
  onRefreshIntervalChange: (intervalSec: number) => void;
  onStartManual: () => void;
  onStopManual: () => void;
}

export function RetailerAutoModeSection({
  openTabs,
  showControls,
  refreshIntervalSec,
  manualStatus,
  manualRunning,
  refreshDisabled,
  savingRefresh,
  refreshError,
  acting,
  actionError,
  autoStartBlocked,
  purchaseLimit,
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
      <TargetTabPills openTabs={openTabs} />

      <CompactNumberField
        className="mt-3"
        id="popup-retailer-refresh-interval"
        label="Hard refresh interval (seconds, 0 = off)"
        min={0}
        max={3600}
        step={1}
        value={draftInterval}
        disabled={refreshDisabled}
        onFocus={() => {
          intervalFocusedRef.current = true;
        }}
        onChange={setDraftInterval}
        onBlur={commitRefreshInterval}
      />

      {savingRefresh && <p className="mt-1 text-xs text-zinc-500">Saving refresh interval…</p>}
      {refreshError && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
          {refreshError}
        </p>
      )}

      {showControls && (
        <div className="mt-2">
          {manualStatus && (
            <p className="text-xs text-zinc-400" role="status" aria-live="polite">
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

          {autoStartBlocked && purchaseLimit != null && (
            <p role="status" aria-live="polite" className="mt-2 text-xs text-red-300">
              Quantity cannot exceed max ({purchaseLimit})
            </p>
          )}

          {actionError && (
            <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
              {actionError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
