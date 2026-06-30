import { useCallback, useEffect, useRef, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import {
  getExtensionSettings,
  getExtensionStatus,
  saveChannelDomains,
} from "@ext/core/lib/messages.ts";
import { getChannelDomains } from "@ext/core/lib/channel-targets.ts";

const SAVE_DEBOUNCE_MS = 400;

export function useChannelDomainsEditor(channelId: string | null, enabled: boolean) {
  const [domains, setDomains] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDomainsRef = useRef<string[] | null>(null);

  const loadDomains = useCallback(async (id: string) => {
    const settings = await getExtensionSettings();
    setDomains(getChannelDomains(settings, id));
  }, []);

  useEffect(() => {
    if (channelId === null) {
      setDomains([]);
      setSaveError(null);
      return;
    }
    void loadDomains(channelId);
  }, [channelId, loadDomains]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area !== "local" || !changes[STORAGE_KEYS.settings] || channelId === null) {
        return;
      }
      void loadDomains(channelId);
    }

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [channelId, loadDomains]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const flushSave = useCallback(async (nextDomains: string[]) => {
    if (!enabled) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const status = await getExtensionStatus();
      const saveChannelId = status.active_channel_id;
      if (saveChannelId === null) {
        return;
      }
      await saveChannelDomains(saveChannelId, nextDomains);
      await loadDomains(saveChannelId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      pendingDomainsRef.current = null;
    }
  }, [enabled, loadDomains]);

  const handleDomainsChange = useCallback(
    (nextDomains: string[]) => {
      setDomains(nextDomains);
      setSaveError(null);
      pendingDomainsRef.current = nextDomains;

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const pending = pendingDomainsRef.current;
        if (pending !== null) {
          void flushSave(pending);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  return {
    domains,
    saving,
    saveError,
    disabled: !enabled || channelId === null,
    handleDomainsChange,
  };
}
