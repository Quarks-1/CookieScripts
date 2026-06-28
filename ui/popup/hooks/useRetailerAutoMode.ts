import { useCallback, useEffect, useState } from "react";

import { sendToBackground } from "@ext/lib/messages.ts";
import { allowlistIncludesRetailerHost } from "@ext/lib/retailer/host.ts";
import type { BackgroundResponse } from "@ext/types/index.ts";

export function useRetailerAutoMode(
  channelId: string | null,
  enabled: boolean,
  domains: string[],
) {
  const [retailerAutoEnabled, setRetailerAutoEnabled] = useState(false);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRefresh, setSavingRefresh] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [stepsRecorded, setStepsRecorded] = useState(0);
  const [clearing, setClearing] = useState(false);

  const canShow = allowlistIncludesRetailerHost(domains);
  const settingsChannelId = channelId ?? "manual";

  const refresh = useCallback(async () => {
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS" });
    if ("status" in response && response.ok) {
      setRefreshIntervalSec(response.status.retailer_refresh_interval_sec);
      if (canShow) {
        setRetailerAutoEnabled(response.status.retailer_auto_enabled);
        setStepsRecorded(response.status.retailer_steps_recorded);
      } else {
        setRetailerAutoEnabled(false);
        setStepsRecorded(0);
      }
    }
  }, [canShow]);

  useEffect(() => {
    void refresh();
  }, [channelId, domains, enabled, refresh]);

  const handleChange = useCallback(
    async (next: boolean) => {
      if (channelId === null || !enabled || !canShow) {
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
    [channelId, enabled, canShow, refresh],
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

  const handleClearRecording = useCallback(async () => {
    setClearing(true);
    try {
      await sendToBackground<BackgroundResponse>({ type: "CLEAR_RETAILER_PROFILE" });
      await refresh();
    } finally {
      setClearing(false);
    }
  }, [refresh]);

  return {
    canShow,
    retailerAutoEnabled,
    refreshIntervalSec,
    stepsRecorded,
    saving,
    saveError,
    savingRefresh,
    refreshError,
    clearing,
    disabled: !enabled || channelId === null || !canShow,
    refreshDisabled: !enabled,
    handleChange,
    handleRefreshIntervalChange,
    handleClearRecording,
  };
}
