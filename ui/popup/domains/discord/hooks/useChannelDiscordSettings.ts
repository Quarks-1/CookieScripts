import { useCallback, useEffect, useRef, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { normalizeDomain } from "@ext/core/lib/domains.ts";
import { getChannelDomains } from "@ext/core/lib/channel-targets.ts";
import {
  getExtensionSettings,
  getExtensionStatus,
  saveChannelDomains,
} from "@ext/core/lib/messages.ts";

const SAVE_DEBOUNCE_MS = 400;

type ChangeOptions = {
  immediate?: boolean;
};

export function useChannelDiscordSettings(channelId: string | null, enabled: boolean) {
  const [domains, setDomains] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDomainsRef = useRef<string[] | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingDomainsRef.current = null;
  }, []);

  const loadSettings = useCallback(async (id: string) => {
    const settings = await getExtensionSettings();
    setDomains(getChannelDomains(settings, id));
  }, []);

  useEffect(() => {
    clearDebounce();
    if (channelId === null) {
      setDomains([]);
      setSaveError(null);
      return;
    }
    void loadSettings(channelId);
  }, [channelId, clearDebounce, loadSettings]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area !== "local" || !changes[STORAGE_KEYS.settings] || channelId === null) {
        return;
      }
      clearDebounce();
      void loadSettings(channelId);
    }

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [channelId, clearDebounce, loadSettings]);

  useEffect(() => {
    return () => {
      clearDebounce();
    };
  }, [clearDebounce]);

  const flushSave = useCallback(
    async (nextDomains: string[]) => {
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
        await loadSettings(saveChannelId);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
        pendingDomainsRef.current = null;
      }
    },
    [enabled, loadSettings],
  );

  const scheduleSave = useCallback(
    (nextDomains: string[], options?: ChangeOptions) => {
      pendingDomainsRef.current = nextDomains;
      setSaveError(null);

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (options?.immediate) {
        void flushSave(nextDomains);
        return;
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

  const handleDomainsChange = useCallback(
    (nextDomains: string[], options?: ChangeOptions) => {
      setDomains(nextDomains);
      scheduleSave(nextDomains, options);
    },
    [scheduleSave],
  );

  const handleAcceptDomain = useCallback(
    async (domain: string) => {
      if (!enabled || channelId === null) {
        return;
      }
      const normalized = normalizeDomain(domain);
      if (!normalized || domains.includes(normalized)) {
        return;
      }
      handleDomainsChange([...domains, normalized], { immediate: true });
    },
    [channelId, domains, enabled, handleDomainsChange],
  );

  return {
    domains,
    saving,
    saveError,
    disabled: !enabled || channelId === null,
    handleDomainsChange,
    handleAcceptDomain,
  };
}
