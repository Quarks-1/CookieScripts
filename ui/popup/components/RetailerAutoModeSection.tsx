import { EnableSlider } from "@shared/components/EnableSlider.tsx";

interface RetailerAutoModeSectionProps {
  retailerAutoEnabled: boolean;
  refreshIntervalSec: number;
  stepsRecorded: number;
  showAutoToggle: boolean;
  showRecording: boolean;
  disabled: boolean;
  refreshDisabled: boolean;
  saving: boolean;
  saveError: string | null;
  savingRefresh: boolean;
  refreshError: string | null;
  clearing: boolean;
  onChange: (enabled: boolean) => void;
  onRefreshIntervalChange: (intervalSec: number) => void;
  onClearRecording: () => void;
}

export function RetailerAutoModeSection({
  retailerAutoEnabled,
  refreshIntervalSec,
  stepsRecorded,
  showAutoToggle,
  showRecording,
  disabled,
  refreshDisabled,
  saving,
  saveError,
  savingRefresh,
  refreshError,
  clearing,
  onChange,
  onRefreshIntervalChange,
  onClearRecording,
}: RetailerAutoModeSectionProps) {
  return (
    <section aria-labelledby="retailer-auto-heading">
      <h2 id="retailer-auto-heading" className="text-sm font-medium text-zinc-400">
        Target Auto Mode
      </h2>
      <div className="mt-2">
        {showAutoToggle && (
          <>
            <EnableSlider
              id="popup-retailer-auto-enabled"
              label="Target Auto Mode"
              checked={retailerAutoEnabled}
              disabled={disabled || saving}
              onChange={onChange}
            />
            <p className="mt-2 text-xs text-zinc-500">
              Opens Target links in a new window, adds to cart, then goes to checkout start.
            </p>
          </>
        )}
        <label className="mt-3 block text-xs text-zinc-500" htmlFor="popup-retailer-refresh-interval">
          Hard refresh interval (seconds, 0 = off)
        </label>
        <input
          id="popup-retailer-refresh-interval"
          type="number"
          min={0}
          max={3600}
          step={1}
          value={refreshIntervalSec}
          disabled={refreshDisabled || savingRefresh}
          onChange={(event) => onRefreshIntervalChange(Number(event.target.value))}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-500">
          While the main Add to cart button is disabled, hard-refresh the page on this interval until
          it becomes available.
        </p>
        {showRecording && (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
            <span>{stepsRecorded} step(s) recorded</span>
            <button
              type="button"
              disabled={clearing || stepsRecorded === 0}
              onClick={onClearRecording}
              className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "Clear"}
            </button>
          </div>
        )}
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
      </div>
    </section>
  );
}
