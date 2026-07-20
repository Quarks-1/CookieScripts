import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

type AtcModeStatus = Pick<
  ExtensionStatus,
  "retailer_frontend_atc_enabled" | "retailer_backend_atc_enabled"
>;

export function useRetailerAtcMode(
  retailerTabDetected: boolean,
  status: AtcModeStatus | null,
) {
  const [frontendEnabled, setFrontendEnabled] = useState(
    () => status?.retailer_frontend_atc_enabled ?? true,
  );
  const [backendEnabled, setBackendEnabled] = useState(
    () => status?.retailer_backend_atc_enabled ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setFrontendEnabled(response.status.retailer_frontend_atc_enabled);
      setBackendEnabled(response.status.retailer_backend_atc_enabled);
    }
  }, []);

  useEffect(() => {
    if (!retailerTabDetected || status == null || saving) {
      return;
    }
    setFrontendEnabled(status.retailer_frontend_atc_enabled);
    setBackendEnabled(status.retailer_backend_atc_enabled);
  }, [retailerTabDetected, status, saving]);

  const saveModes = useCallback(
    async (nextFrontend: boolean, nextBackend: boolean) => {
      if (!nextFrontend && !nextBackend) {
        setSaveError("Enable at least one ATC method");
        return;
      }

      const prevFrontend = frontendEnabled;
      const prevBackend = backendEnabled;
      setSaving(true);
      setSaveError(null);
      setFrontendEnabled(nextFrontend);
      setBackendEnabled(nextBackend);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_ATC_MODES",
          frontend_enabled: nextFrontend,
          backend_enabled: nextBackend,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setFrontendEnabled(prevFrontend);
        setBackendEnabled(prevBackend);
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [frontendEnabled, backendEnabled, refresh],
  );

  return {
    frontendEnabled,
    backendEnabled,
    saving,
    saveError,
    handleFrontendChange: (next: boolean) => void saveModes(next, backendEnabled),
    handleBackendChange: (next: boolean) => void saveModes(frontendEnabled, next),
  };
}
