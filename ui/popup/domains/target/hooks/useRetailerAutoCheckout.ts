import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse } from "@ext/core/types/index.ts";

export function useRetailerAutoCheckout(retailerTabDetected: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setEnabled(response.status.retailer_auto_checkout_enabled);
    }
  }, []);

  useEffect(() => {
    if (retailerTabDetected) {
      void refresh();
    }
  }, [retailerTabDetected, refresh]);

  const saveEnabled = useCallback(
    async (next: boolean) => {
      const prev = enabled;
      setSaving(true);
      setSaveError(null);
      setEnabled(next);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_AUTO_CHECKOUT_ENABLED",
          enabled: next,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (error) {
        setEnabled(prev);
        setSaveError(error instanceof Error ? error.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [enabled, refresh],
  );

  return {
    enabled,
    saving,
    saveError,
    onChange: saveEnabled,
  };
}
