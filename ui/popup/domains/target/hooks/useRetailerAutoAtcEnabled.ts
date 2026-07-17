import { useState } from "react";

import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

export function useRetailerAutoAtcEnabled(
  status: ExtensionStatus,
  onRefresh: () => Promise<void>,
) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await sendToBackground<BackgroundResponse>({
        type: "SET_RETAILER_AUTO_ATC_ENABLED",
        enabled: next,
      });
      if ("ok" in response && response.ok === false) {
        throw new Error(response.error);
      }
      await onRefresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return {
    enabled: status.retailer_auto_atc_enabled,
    saving,
    saveError,
    onChange: handleChange,
  };
}
