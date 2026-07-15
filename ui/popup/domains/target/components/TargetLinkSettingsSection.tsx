import { useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { CompactNumberField } from "@shared/components/CompactNumberField.tsx";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { useRetailerLinkOpenCount } from "../hooks/useRetailerLinkOpenCount.ts";

// Target-only Discord link-open settings today (`sku_open_mode_enabled`, `retailer_link_open_count`).
// UI lives on the Target tab; move to `GlobalSettingsSection` if other retailers gain SKU/open-count support.

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
  const [skuOpenModeSaving, setSkuOpenModeSaving] = useState(false);
  const [skuOpenModeError, setSkuOpenModeError] = useState<string | null>(null);
  const linkOpenCount = useRetailerLinkOpenCount(status, onRefresh);

  async function handleSkuOpenModeChange(next: boolean) {
    setSkuOpenModeSaving(true);
    setSkuOpenModeError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings({ ...settings, sku_open_mode_enabled: next });
      await onRefresh();
    } catch (err) {
      setSkuOpenModeError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSkuOpenModeSaving(false);
    }
  }

  return (
    <section aria-labelledby="target-link-settings-heading" className="space-y-3">
      <h2 id="target-link-settings-heading" className="text-sm font-medium text-zinc-400">
        Link opens
      </h2>

      <EnableSlider
        id="popup-sku-open-mode"
        label="SKU open mode"
        checked={status.sku_open_mode_enabled}
        disabled={disabled || skuOpenModeSaving}
        onChange={(next) => void handleSkuOpenModeChange(next)}
      />
      {skuOpenModeSaving && <p className="text-xs text-zinc-500">Saving…</p>}
      {skuOpenModeError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {skuOpenModeError}
        </p>
      )}

      <CompactNumberField
        id="popup-retailer-link-open-count"
        label="Target opens per link"
        min={1}
        step={1}
        value={linkOpenCount.draftCount}
        disabled={linkOpenCount.disabled}
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
