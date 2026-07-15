import { useState } from "react";

import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

// Per-channel Discord → Target auto-open flag (`retailer_auto_atc_enabled` on channel_targets).
// UI lives on the Target tab because it controls Target automation, not Discord watch behavior.

export function useRetailerAutoAtcEnabled(
  status: ExtensionStatus,
  onRefresh: () => Promise<void>,
) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const channelId = status.active_channel_id;

  async function handleChange(next: boolean) {
    if (channelId === null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const response = await sendToBackground<BackgroundResponse>({
        type: "SET_RETAILER_AUTO_ATC_ENABLED",
        channel_id: channelId,
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
    controlsDisabled: channelId === null || !status.has_allowed_domains,
    saving,
    saveError,
    onChange: handleChange,
  };
}
