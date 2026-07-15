import { SkuPills } from "@shared/components/SkuPills.tsx";

interface ChannelSkuWatchSectionProps {
  channelId: string | null;
  targetSkus: string[];
  disabled?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onTargetSkusChange: (skus: string[]) => void;
}

export function ChannelSkuWatchSection({
  channelId,
  targetSkus,
  disabled,
  saving,
  saveError,
  onTargetSkusChange,
}: ChannelSkuWatchSectionProps) {
  if (channelId === null) {
    return (
      <section
        aria-labelledby="sku-watch-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
      >
        <h2 id="sku-watch-heading" className="text-sm font-medium text-zinc-400">
          Target SKUs
        </h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="sku-watch-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
    >
      <h2 id="sku-watch-heading" className="text-sm font-medium text-zinc-400">
        Target SKUs
      </h2>

      <div className="mt-3">
        <SkuPills
          skus={targetSkus}
          onChange={onTargetSkusChange}
          disabled={disabled || saving}
          inputId="popup-target-sku-input"
        />
      </div>

      {saving && <p className="mt-2 text-xs text-zinc-500">Saving…</p>}
      {saveError && (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
