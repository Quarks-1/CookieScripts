import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

type AutoRefreshStatus = Pick<
  ExtensionStatus,
  "walmart_auto_refresh_enabled" | "walmart_refresh_interval_sec"
>;

export function useWalmartAutoRefresh(
  walmartTabDetected: boolean,
  extensionEnabled: boolean,
  status: AutoRefreshStatus | null,
) {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(
    () => status?.walmart_auto_refresh_enabled ?? false,
  );
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(
    () => status?.walmart_refresh_interval_sec ?? 10,
  );
  const [savingRefresh, setSavingRefresh] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [enableError, setEnableError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setAutoRefreshEnabled(response.status.walmart_auto_refresh_enabled);
      setRefreshIntervalSec(response.status.walmart_refresh_interval_sec);
    }
  }, []);

  useEffect(() => {
    if (status == null) {
      return;
    }
    if (!savingEnabled) {
      setAutoRefreshEnabled(status.walmart_auto_refresh_enabled);
    }
    if (!savingRefresh) {
      setRefreshIntervalSec(status.walmart_refresh_interval_sec);
    }
  }, [status, savingEnabled, savingRefresh]);

  useEffect(() => {
    if (!walmartTabDetected || !extensionEnabled) {
      return;
    }
    const timer = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(timer);
  }, [walmartTabDetected, extensionEnabled, refresh]);

  const handleEnabledChange = useCallback(
    async (next: boolean) => {
      if (!extensionEnabled || refreshIntervalSec < 1) {
        return;
      }
      setSavingEnabled(true);
      setEnableError(null);
      setAutoRefreshEnabled(next);
      try {
        const window_id = await getSidePanelWindowId();
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_WALMART_AUTO_REFRESH_ENABLED",
          enabled: next,
          window_id,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setEnableError(err instanceof Error ? err.message : "Save failed");
        await refresh();
      } finally {
        setSavingEnabled(false);
      }
    },
    [extensionEnabled, refresh, refreshIntervalSec],
  );

  const handleRefreshIntervalChange = useCallback(
    async (intervalSec: number) => {
      if (!extensionEnabled) {
        return;
      }
      setSavingRefresh(true);
      setRefreshError(null);
      setRefreshIntervalSec(intervalSec);
      try {
        const window_id = await getSidePanelWindowId();
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_WALMART_REFRESH_INTERVAL",
          interval_sec: intervalSec,
          window_id,
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
    [extensionEnabled, refresh],
  );

  return {
    autoRefreshEnabled,
    refreshIntervalSec,
    savingRefresh,
    savingEnabled,
    refreshError,
    enableError,
    handleEnabledChange,
    handleRefreshIntervalChange,
  };
}
