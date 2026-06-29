import { useCallback, useEffect, useState } from "react";

import { sendToBackground } from "@ext/lib/messages.ts";
import type { BackgroundResponse } from "@ext/types/index.ts";

export function useRetailerAtcMode(retailerTabDetected: boolean) {
  const [frontendEnabled, setFrontendEnabled] = useState(true);
  const [backendEnabled, setBackendEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS" });
    if ("status" in response && response.ok) {
      setFrontendEnabled(response.status.retailer_frontend_atc_enabled);
      setBackendEnabled(response.status.retailer_backend_atc_enabled);
    }
  }, []);

  useEffect(() => {
    if (retailerTabDetected) {
      void refresh();
    }
  }, [retailerTabDetected, refresh]);

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
