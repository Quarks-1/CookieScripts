import { useCallback, useEffect, useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import { WALMART_THROTTLE_DEFAULT_INTERVAL_SEC } from "@ext/domains/walmart/lib/constants.ts";
import { normalizeWalmartRefreshIntervalSec } from "@ext/domains/walmart/lib/auto-refresh.ts";

export function useWalmartQueueSettings(walmartTabDetected: boolean, extensionEnabled: boolean) {
  const [queuePassSoundEnabled, setQueuePassSoundEnabled] = useState(true);
  const [consolidateQueueTabsEnabled, setConsolidateQueueTabsEnabled] = useState(true);
  const [throttleRefreshIntervalSec, setThrottleRefreshIntervalSec] = useState(
    WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const settings = await getExtensionSettings();
    setQueuePassSoundEnabled(settings.walmart_queue_pass_sound_enabled !== false);
    setConsolidateQueueTabsEnabled(settings.walmart_consolidate_queue_tabs_enabled !== false);
    setThrottleRefreshIntervalSec(
      normalizeWalmartRefreshIntervalSec(
        settings.walmart_throttle_refresh_interval_sec ?? WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
      ),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [walmartTabDetected, extensionEnabled, refresh]);

  const saveSettings = useCallback(
    async (patch: {
      queuePassSoundEnabled?: boolean;
      consolidateQueueTabsEnabled?: boolean;
      throttleRefreshIntervalSec?: number;
    }) => {
      setSaving(true);
      setError(null);
      try {
        const settings = await getExtensionSettings();
        const next = {
          ...settings,
          walmart_queue_pass_sound_enabled:
            patch.queuePassSoundEnabled ?? settings.walmart_queue_pass_sound_enabled ?? true,
          walmart_consolidate_queue_tabs_enabled:
            patch.consolidateQueueTabsEnabled ??
            settings.walmart_consolidate_queue_tabs_enabled ??
            true,
          walmart_throttle_refresh_interval_sec: normalizeWalmartRefreshIntervalSec(
            patch.throttleRefreshIntervalSec ??
              settings.walmart_throttle_refresh_interval_sec ??
              WALMART_THROTTLE_DEFAULT_INTERVAL_SEC,
          ),
        };
        await saveExtensionSettings(next);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const handleQueuePassSoundChange = useCallback(
    (enabled: boolean) => {
      setQueuePassSoundEnabled(enabled);
      void saveSettings({ queuePassSoundEnabled: enabled });
    },
    [saveSettings],
  );

  const handleConsolidateQueueTabsChange = useCallback(
    (enabled: boolean) => {
      setConsolidateQueueTabsEnabled(enabled);
      void saveSettings({ consolidateQueueTabsEnabled: enabled });
    },
    [saveSettings],
  );

  const handleThrottleIntervalChange = useCallback(
    (intervalSec: number) => {
      setThrottleRefreshIntervalSec(intervalSec);
      void saveSettings({ throttleRefreshIntervalSec: intervalSec });
    },
    [saveSettings],
  );

  return {
    queuePassSoundEnabled,
    consolidateQueueTabsEnabled,
    throttleRefreshIntervalSec,
    saving,
    error,
    handleQueuePassSoundChange,
    handleConsolidateQueueTabsChange,
    handleThrottleIntervalChange,
  };
}
