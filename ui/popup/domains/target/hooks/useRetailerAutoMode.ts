import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse } from "@ext/core/types/index.ts";

export function useRetailerAutoMode(
  channelId: string | null,
  enabled: boolean,
  retailerTabDetected: boolean,
) {
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(0);
  const [manualStatus, setManualStatus] = useState("");
  const [manualRunning, setManualRunning] = useState(false);
  const [savingRefresh, setSavingRefresh] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const settingsChannelId = channelId ?? "manual";

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setRefreshIntervalSec(response.status.retailer_refresh_interval_sec);
      setManualStatus(response.status.retailer_manual_status);
      setManualRunning(response.status.retailer_manual_running);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [channelId, enabled, retailerTabDetected, refresh]);

  useEffect(() => {
    if (!retailerTabDetected || !enabled) {
      return;
    }
    const timer = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(timer);
  }, [retailerTabDetected, enabled, refresh]);

  const handleRefreshIntervalChange = useCallback(
    async (intervalSec: number) => {
      if (!enabled) {
        return;
      }
      const normalized = Number.isFinite(intervalSec) ? Math.max(0, Math.floor(intervalSec)) : 0;
      setSavingRefresh(true);
      setRefreshError(null);
      setRefreshIntervalSec(normalized);
      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_REFRESH_INTERVAL",
          channel_id: settingsChannelId,
          interval_sec: normalized,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setRefreshError(err instanceof Error ? err.message : "Save failed");
        await refresh();
      } finally {
        setSavingRefresh(false);
      }
    },
    [enabled, settingsChannelId, refresh],
  );

  const runTabAction = useCallback(
    async (type: "RETAILER_START_MANUAL_AUTO" | "RETAILER_STOP_MANUAL_AUTO") => {
      const starting = type === "RETAILER_START_MANUAL_AUTO";
      setActing(true);
      setActionError(null);
      if (starting) {
        setManualRunning(true);
        setManualStatus("Starting auto mode…");
      } else {
        setManualRunning(false);
        setManualStatus("Stopped");
      }
      try {
        const window_id = await getSidePanelWindowId();
        const response = await sendToBackground<BackgroundResponse>({ type, window_id });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
        await refresh();
      } finally {
        setActing(false);
      }
    },
    [refresh],
  );

  return {
    refreshIntervalSec,
    manualStatus,
    manualRunning,
    savingRefresh,
    refreshError,
    acting,
    actionError,
    refreshDisabled: !enabled,
    handleRefreshIntervalChange,
    handleStartManual: () => runTabAction("RETAILER_START_MANUAL_AUTO"),
    handleStopManual: () => runTabAction("RETAILER_STOP_MANUAL_AUTO"),
  };
}
