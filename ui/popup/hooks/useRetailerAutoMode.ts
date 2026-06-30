import { useCallback, useEffect, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/lib/messages.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import type { BackgroundResponse } from "@ext/types/index.ts";

export function useRetailerAutoMode(
  channelId: string | null,
  enabled: boolean,
  domains: string[],
  retailerTabDetected: boolean,
) {
  const [retailerAutoEnabled, setRetailerAutoEnabled] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(0);
  const [manualStatus, setManualStatus] = useState("");
  const [manualRunning, setManualRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRefresh, setSavingRefresh] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canShowDiscordAuto = allowlistIncludesRetailerHost(domains);
  const settingsChannelId = channelId ?? "manual";

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      setRefreshIntervalSec(response.status.retailer_refresh_interval_sec);
      setManualStatus(response.status.retailer_manual_status);
      setManualRunning(response.status.retailer_manual_running);
      if (canShowDiscordAuto) {
        setRetailerAutoEnabled(response.status.retailer_auto_enabled);
      } else {
        setRetailerAutoEnabled(false);
      }
    }
  }, [canShowDiscordAuto]);

  useEffect(() => {
    void refresh();
  }, [channelId, domains, enabled, retailerTabDetected, refresh]);

  useEffect(() => {
    if (!retailerTabDetected || (!manualRunning && !acting)) {
      return;
    }
    const timer = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(timer);
  }, [retailerTabDetected, manualRunning, acting, refresh]);

  const handleChange = useCallback(
    async (next: boolean) => {
      if (channelId === null || !enabled || !canShowDiscordAuto) {
        return;
      }
      setSaving(true);
      setSaveError(null);
      setRetailerAutoEnabled(next);
      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_AUTO_ENABLED",
          channel_id: channelId,
          enabled: next,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (err) {
        setRetailerAutoEnabled(!next);
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [channelId, enabled, canShowDiscordAuto, refresh],
  );

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
    canShowDiscordAuto,
    retailerAutoEnabled,
    refreshIntervalSec,
    manualStatus,
    manualRunning,
    saving,
    saveError,
    savingRefresh,
    refreshError,
    acting,
    actionError,
    disabled: !enabled || channelId === null || !canShowDiscordAuto,
    refreshDisabled: !enabled,
    handleChange,
    handleRefreshIntervalChange,
    handleStartManual: () => runTabAction("RETAILER_START_MANUAL_AUTO"),
    handleStopManual: () => runTabAction("RETAILER_STOP_MANUAL_AUTO"),
  };
}
