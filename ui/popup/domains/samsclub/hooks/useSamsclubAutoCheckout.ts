import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type {
  BackgroundResponse,
  ExtensionStatus,
  SamsclubAutoCheckoutMode,
} from "@ext/core/types/index.ts";

type AutoCheckoutStatus = Pick<ExtensionStatus, "samsclub_auto_checkout_mode">;

export function useSamsclubAutoCheckout(
  samsclubTabDetected: boolean,
  status: AutoCheckoutStatus | null,
) {
  const [mode, setMode] = useState<SamsclubAutoCheckoutMode>(
    () => status?.samsclub_auto_checkout_mode ?? "off",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setMode(response.status.samsclub_auto_checkout_mode);
    }
  }, []);

  useEffect(() => {
    if (!samsclubTabDetected || status == null || saving) {
      return;
    }
    setMode(status.samsclub_auto_checkout_mode);
  }, [samsclubTabDetected, status, saving]);

  const saveMode = useCallback(
    async (next: SamsclubAutoCheckoutMode) => {
      const prev = mode;
      setSaving(true);
      setSaveError(null);
      setMode(next);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_SAMSCLUB_AUTO_CHECKOUT_MODE",
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
