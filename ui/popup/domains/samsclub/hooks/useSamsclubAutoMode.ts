import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

type AutoModeStatus = Pick<
  ExtensionStatus,
  "samsclub_refresh_interval_sec" | "samsclub_manual_status" | "samsclub_manual_running"
>;

export function useSamsclubAutoMode(
  enabled: boolean,
  samsclubTabDetected: boolean,
  status: AutoModeStatus | null,
) {
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(
    () => status?.samsclub_refresh_interval_sec ?? 0,
  );
  const [manualStatus, setManualStatus] = useState(() => status?.samsclub_manual_status ?? "");
  const [manualRunning, setManualRunning] = useState(
    () => status?.samsclub_manual_running ?? false,
  );
  const [savingRefresh, setSavingRefresh] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setRefreshIntervalSec(response.status.samsclub_refresh_interval_sec);
      setManualStatus(response.status.samsclub_manual_status);
      setManualRunning(response.status.samsclub_manual_running);
    }
  }, []);

  useEffect(() => {
    if (status == null) {
      return;
    }
    if (!savingRefresh) {
      setRefreshIntervalSec(status.samsclub_refresh_interval_sec);
    }
    setManualStatus(status.samsclub_manual_status);
    setManualRunning(status.samsclub_manual_running);
  }, [status, savingRefresh]);

  useEffect(() => {
    if (!samsclubTabDetected || !enabled) {
      return;
    }
    const timer = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(timer);
  }, [samsclubTabDetected, enabled, refresh]);

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
          type: "SET_SAMSCLUB_REFRESH_INTERVAL",
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
    [enabled, refresh],
  );

  const runTabAction = useCallback(
    async (type: "SAMSCLUB_START_MANUAL_AUTO" | "SAMSCLUB_STOP_MANUAL_AUTO") => {
      const starting = type === "SAMSCLUB_START_MANUAL_AUTO";
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
    handleStartManual: () => runTabAction("SAMSCLUB_START_MANUAL_AUTO"),
    handleStopManual: () => runTabAction("SAMSCLUB_STOP_MANUAL_AUTO"),
  };
}
