import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type {
  BackgroundResponse,
  ExtensionStatus,
  RetailerAutoCheckoutMode,
} from "@ext/core/types/index.ts";

type AutoCheckoutStatus = Pick<ExtensionStatus, "retailer_auto_checkout_mode">;

export function useRetailerAutoCheckout(
  retailerTabDetected: boolean,
  status: AutoCheckoutStatus | null,
) {
  const [mode, setMode] = useState<RetailerAutoCheckoutMode>(
    () => status?.retailer_auto_checkout_mode ?? "off",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setMode(response.status.retailer_auto_checkout_mode);
    }
  }, []);

  useEffect(() => {
    if (!retailerTabDetected || status == null || saving) {
      return;
    }
    setMode(status.retailer_auto_checkout_mode);
  }, [retailerTabDetected, status, saving]);

  const saveMode = useCallback(
    async (next: RetailerAutoCheckoutMode) => {
      const prev = mode;
      setSaving(true);
      setSaveError(null);
      setMode(next);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_AUTO_CHECKOUT_MODE",
          mode: next,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (error) {
        setMode(prev);
        setSaveError(error instanceof Error ? error.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [mode, refresh],
  );

  return {
    mode,
    saving,
    saveError,
    onChange: saveMode,
  };
}
