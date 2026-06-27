import { EnableSlider } from "@shared/components/EnableSlider.tsx";

interface RetailerAutoModeSectionProps {
  retailerAutoEnabled: boolean;
  stepsRecorded: number;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  clearing: boolean;
  onChange: (enabled: boolean) => void;
  onClearRecording: () => void;
}

export function RetailerAutoModeSection({
  retailerAutoEnabled,
  stepsRecorded,
  disabled,
  saving,
  saveError,
  clearing,
  onChange,
  onClearRecording,
}: RetailerAutoModeSectionProps) {
  return (
    <section aria-labelledby="retailer-auto-heading">
      <h2 id="retailer-auto-heading" className="text-sm font-medium text-zinc-400">
        Target Auto Mode
      </h2>
      <div className="mt-2">
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
        {saving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {saveError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {saveError}
          </p>
        )}
      </div>
    </section>
  );
}
