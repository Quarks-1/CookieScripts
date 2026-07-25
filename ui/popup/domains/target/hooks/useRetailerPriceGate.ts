import { useCallback, useEffect, useState } from "react";

import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

type PriceGateStatus = Pick<ExtensionStatus, "retailer_price_gate_enabled">;

export function useRetailerPriceGate(
  retailerTabDetected: boolean,
  status: PriceGateStatus | null,
) {
  const [enabled, setEnabled] = useState(
    () => status?.retailer_price_gate_enabled ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS" });
    if ("status" in response && response.ok) {
      setEnabled(response.status.retailer_price_gate_enabled);
    }
  }, []);

  useEffect(() => {
    if (!retailerTabDetected || status == null || saving) {
      return;
    }
    setEnabled(status.retailer_price_gate_enabled);
  }, [retailerTabDetected, status, saving]);

  const saveEnabled = useCallback(
    async (next: boolean) => {
      const prev = enabled;
      setSaving(true);
      setSaveError(null);
      setEnabled(next);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_PRICE_GATE_ENABLED",
          enabled: next,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setEnabled(prev);
        setSaveError(err instanceof Error ? err.message : "Failed to save");
        await refresh();
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
