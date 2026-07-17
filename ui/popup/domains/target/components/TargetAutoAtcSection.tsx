import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { useRetailerAutoAtcEnabled } from "../hooks/useRetailerAutoAtcEnabled.ts";

interface TargetAutoAtcSectionProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function TargetAutoAtcSection({ status, disabled, onRefresh }: TargetAutoAtcSectionProps) {
  const autoAtc = useRetailerAutoAtcEnabled(status, onRefresh);

  return (
    <section aria-labelledby="target-auto-atc-heading">
      <h2 id="target-auto-atc-heading" className="sr-only">
        Auto ATC
      </h2>
      <EnableSlider
        id="popup-retailer-auto-atc"
        label="Enable Auto ATC"
        checked={autoAtc.enabled}
        disabled={disabled || autoAtc.saving}
        onChange={(next) => void autoAtc.onChange(next)}
      />
      {autoAtc.saving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
      {autoAtc.saveError && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
          {autoAtc.saveError}
        </p>
      )}
    </section>
  );
}
