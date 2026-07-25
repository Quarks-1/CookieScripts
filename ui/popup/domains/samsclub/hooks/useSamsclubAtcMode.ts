import { useCallback, useEffect, useState } from "react";

import {
  atcModeFromBooleans,
  booleansFromAtcMode,
  type AtcMode,
} from "@ext/core/lib/atc-mode.ts";
import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

type AtcModeStatus = Pick<
  ExtensionStatus,
  "samsclub_frontend_atc_enabled" | "samsclub_backend_atc_enabled"
>;

export function useSamsclubAtcMode(
  samsclubTabDetected: boolean,
  status: AtcModeStatus | null,
) {
  const [mode, setMode] = useState<AtcMode>(() =>
    atcModeFromBooleans(
      status?.samsclub_frontend_atc_enabled ?? false,
      status?.samsclub_backend_atc_enabled ?? false,
    ),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setMode(
        atcModeFromBooleans(
          response.status.samsclub_frontend_atc_enabled,
          response.status.samsclub_backend_atc_enabled,
        ),
      );
    }
  }, []);

  useEffect(() => {
    if (!samsclubTabDetected || status == null || saving) {
      return;
    }
    setMode(
      atcModeFromBooleans(
        status.samsclub_frontend_atc_enabled,
        status.samsclub_backend_atc_enabled,
      ),
    );
  }, [samsclubTabDetected, status, saving]);

  const handleModeChange = useCallback(
    async (nextMode: AtcMode) => {
      const { frontend: nextFrontend, backend: nextBackend } = booleansFromAtcMode(nextMode);
      const prevMode = mode;
      setSaving(true);
      setSaveError(null);
      setMode(nextMode);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_SAMSCLUB_ATC_MODES",
          frontend_enabled: nextFrontend,
          backend_enabled: nextBackend,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setMode(prevMode);
        setSaveError(err instanceof Error ? err.message : "Save failed");
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
    handleModeChange,
  };
}
