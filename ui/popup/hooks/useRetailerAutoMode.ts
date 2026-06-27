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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stepsRecorded, setStepsRecorded] = useState(0);
  const [clearing, setClearing] = useState(false);

  const canShow = allowlistIncludesRetailerHost(domains);

  const refresh = useCallback(async () => {
    if (!canShow) {
      setRetailerAutoEnabled(false);
      setStepsRecorded(0);
      return;
    }
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS" });
    if ("status" in response && response.ok) {
      setRetailerAutoEnabled(response.status.retailer_auto_enabled);
      setStepsRecorded(response.status.retailer_steps_recorded);
    }
  }, [canShow]);

  useEffect(() => {
    void refresh();
  }, [channelId, domains, refresh]);

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
    stepsRecorded,
    saving,
    saveError,
    clearing,
    disabled: !enabled || channelId === null || !canShow,
    handleChange,
    handleClearRecording,
  };
}
