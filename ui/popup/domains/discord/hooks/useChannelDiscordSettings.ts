import { useCallback, useEffect, useRef, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { normalizeDomain } from "@ext/core/lib/domains.ts";
import {
  getChannelDomains,
  getChannelKeywords,
  getChannelWatchSkus,
} from "@ext/core/lib/channel-targets.ts";
import {
  getExtensionSettings,
  getExtensionStatus,
  saveChannelDiscordSettings,
} from "@ext/core/lib/messages.ts";

const SAVE_DEBOUNCE_MS = 400;

type PendingSettings = {
  domains: string[];
  targetPositiveKeywords: string[];
  targetNegativeKeywords: string[];
  walmartPositiveKeywords: string[];
  walmartNegativeKeywords: string[];
  targetSkus: string[];
};

type ChangeOptions = {
  immediate?: boolean;
};

export function useChannelDiscordSettings(channelId: string | null, enabled: boolean) {
  const [domains, setDomains] = useState<string[]>([]);
  const [targetPositiveKeywords, setTargetPositiveKeywords] = useState<string[]>([]);
  const [targetNegativeKeywords, setTargetNegativeKeywords] = useState<string[]>([]);
  const [walmartPositiveKeywords, setWalmartPositiveKeywords] = useState<string[]>([]);
  const [walmartNegativeKeywords, setWalmartNegativeKeywords] = useState<string[]>([]);
  const [targetSkus, setTargetSkus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingSettings | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const loadSettings = useCallback(async (id: string) => {
    const settings = await getExtensionSettings();
    setDomains(getChannelDomains(settings, id));
    const targetKeywords = getChannelKeywords(settings, id, "target");
    const walmartKeywords = getChannelKeywords(settings, id, "walmart");
    setTargetPositiveKeywords(targetKeywords.positive);
    setTargetNegativeKeywords(targetKeywords.negative);
    setWalmartPositiveKeywords(walmartKeywords.positive);
    setWalmartNegativeKeywords(walmartKeywords.negative);
    setTargetSkus(getChannelWatchSkus(settings, id, "target"));
  }, []);

  useEffect(() => {
    clearDebounce();
    if (channelId === null) {
      setDomains([]);
      setTargetPositiveKeywords([]);
      setTargetNegativeKeywords([]);
      setWalmartPositiveKeywords([]);
      setWalmartNegativeKeywords([]);
      setTargetSkus([]);
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
    async (pending: PendingSettings) => {
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
        await saveChannelDiscordSettings(saveChannelId, {
          domains: pending.domains,
          targetPositiveKeywords: pending.targetPositiveKeywords,
          targetNegativeKeywords: pending.targetNegativeKeywords,
          walmartPositiveKeywords: pending.walmartPositiveKeywords,
          walmartNegativeKeywords: pending.walmartNegativeKeywords,
          targetSkus: pending.targetSkus,
        });
        await loadSettings(saveChannelId);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
        pendingRef.current = null;
      }
    },
    [enabled, loadSettings],
  );

  const scheduleSave = useCallback(
    (pending: PendingSettings, options?: ChangeOptions) => {
      pendingRef.current = pending;
      setSaveError(null);

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (options?.immediate) {
        void flushSave(pending);
        return;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const nextPending = pendingRef.current;
        if (nextPending !== null) {
          void flushSave(nextPending);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  const currentPending = useCallback(
    (): PendingSettings => ({
      domains,
      targetPositiveKeywords,
      targetNegativeKeywords,
      walmartPositiveKeywords,
      walmartNegativeKeywords,
      targetSkus,
    }),
    [
      domains,
      targetNegativeKeywords,
      targetPositiveKeywords,
      targetSkus,
      walmartNegativeKeywords,
      walmartPositiveKeywords,
    ],
  );

  const handleDomainsChange = useCallback(
    (nextDomains: string[], options?: ChangeOptions) => {
      setDomains(nextDomains);
      scheduleSave({ ...currentPending(), domains: nextDomains }, options);
    },
    [currentPending, scheduleSave],
  );

  const handleTargetPositiveKeywordsChange = useCallback(
    (nextKeywords: string[], options?: ChangeOptions) => {
      const blocked = new Set(targetNegativeKeywords);
      if (nextKeywords.some((keyword) => blocked.has(keyword))) {
        return;
      }
      setTargetPositiveKeywords(nextKeywords);
      scheduleSave({ ...currentPending(), targetPositiveKeywords: nextKeywords }, options);
    },
    [currentPending, scheduleSave, targetNegativeKeywords],
  );

  const handleTargetNegativeKeywordsChange = useCallback(
    (nextKeywords: string[], options?: ChangeOptions) => {
      const blocked = new Set(targetPositiveKeywords);
      if (nextKeywords.some((keyword) => blocked.has(keyword))) {
        return;
      }
      setTargetNegativeKeywords(nextKeywords);
      scheduleSave({ ...currentPending(), targetNegativeKeywords: nextKeywords }, options);
    },
    [currentPending, scheduleSave, targetPositiveKeywords],
  );

  const handleWalmartPositiveKeywordsChange = useCallback(
    (nextKeywords: string[], options?: ChangeOptions) => {
      const blocked = new Set(walmartNegativeKeywords);
      if (nextKeywords.some((keyword) => blocked.has(keyword))) {
        return;
      }
      setWalmartPositiveKeywords(nextKeywords);
      scheduleSave({ ...currentPending(), walmartPositiveKeywords: nextKeywords }, options);
    },
    [currentPending, scheduleSave, walmartNegativeKeywords],
  );

  const handleWalmartNegativeKeywordsChange = useCallback(
    (nextKeywords: string[], options?: ChangeOptions) => {
      const blocked = new Set(walmartPositiveKeywords);
      if (nextKeywords.some((keyword) => blocked.has(keyword))) {
        return;
      }
      setWalmartNegativeKeywords(nextKeywords);
      scheduleSave({ ...currentPending(), walmartNegativeKeywords: nextKeywords }, options);
    },
    [currentPending, scheduleSave, walmartPositiveKeywords],
  );

  const handleTargetSkusChange = useCallback(
    (nextSkus: string[], options?: ChangeOptions) => {
      setTargetSkus(nextSkus);
      scheduleSave({ ...currentPending(), targetSkus: nextSkus }, options);
    },
    [currentPending, scheduleSave],
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
    targetPositiveKeywords,
    targetNegativeKeywords,
    walmartPositiveKeywords,
    walmartNegativeKeywords,
    targetSkus,
    saving,
    saveError,
    disabled: !enabled || channelId === null,
    handleDomainsChange,
    handleTargetPositiveKeywordsChange,
    handleTargetNegativeKeywordsChange,
    handleWalmartPositiveKeywordsChange,
    handleWalmartNegativeKeywordsChange,
    handleTargetSkusChange,
    handleAcceptDomain,
  };
}
