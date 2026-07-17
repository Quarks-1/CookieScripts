import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { CompactNumberField } from "@shared/components/CompactNumberField.tsx";
import { useRetailerLinkOpenCount } from "../hooks/useRetailerLinkOpenCount.ts";

interface TargetLinkSettingsSectionProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function TargetLinkSettingsSection({
  status,
  disabled,
  onRefresh,
}: TargetLinkSettingsSectionProps) {
  const linkOpenCount = useRetailerLinkOpenCount(status, onRefresh);

  return (
    <section aria-labelledby="target-link-settings-heading" className="space-y-3">
      <h2 id="target-link-settings-heading" className="text-sm font-medium text-zinc-400">
        Link opens
      </h2>

      <CompactNumberField
        id="popup-retailer-link-open-count"
        label="Target opens per link"
        min={1}
        step={1}
        value={linkOpenCount.draftCount}
        disabled={disabled || linkOpenCount.disabled}
        onFocus={linkOpenCount.onFocus}
        onChange={linkOpenCount.setDraftCount}
        onBlur={() => void linkOpenCount.commit()}
      />
      {linkOpenCount.saving && <p className="text-xs text-zinc-500">Saving…</p>}
      {linkOpenCount.saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {linkOpenCount.saveError}
        </p>
      )}
    </section>
  );
}
