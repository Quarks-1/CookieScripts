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
  positiveKeywords: string[];
  negativeKeywords: string[];
  targetSkus: string[];
};

type ChangeOptions = {
  immediate?: boolean;
};

export function useChannelDiscordSettings(channelId: string | null, enabled: boolean) {
  const [domains, setDomains] = useState<string[]>([]);
  const [positiveKeywords, setPositiveKeywords] = useState<string[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>([]);
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
    const keywords = getChannelKeywords(settings, id);
    setPositiveKeywords(keywords.positive);
    setNegativeKeywords(keywords.negative);
    setTargetSkus(getChannelWatchSkus(settings, id, "target"));
  }, []);

  useEffect(() => {
    clearDebounce();
    if (channelId === null) {
      setDomains([]);
      setPositiveKeywords([]);
      setNegativeKeywords([]);
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
          positiveKeywords: pending.positiveKeywords,
          negativeKeywords: pending.negativeKeywords,
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

  const handleDomainsChange = useCallback(
    (nextDomains: string[], options?: ChangeOptions) => {
      setDomains(nextDomains);
      scheduleSave(
        {
          domains: nextDomains,
          positiveKeywords,
          negativeKeywords,
          targetSkus,
        },
        options,
      );
    },
    [negativeKeywords, positiveKeywords, scheduleSave, targetSkus],
  );

  const handlePositiveKeywordsChange = useCallback(
    (nextKeywords: string[], options?: ChangeOptions) => {
      const blocked = new Set(negativeKeywords);
      if (nextKeywords.some((keyword) => blocked.has(keyword))) {
        return;
      }
      setPositiveKeywords(nextKeywords);
      scheduleSave(
        {
          domains,
          positiveKeywords: nextKeywords,
          negativeKeywords,
          targetSkus,
        },
        options,
      );
    },
    [domains, negativeKeywords, scheduleSave, targetSkus],
  );

  const handleNegativeKeywordsChange = useCallback(
    (nextKeywords: string[], options?: ChangeOptions) => {
      const blocked = new Set(positiveKeywords);
      if (nextKeywords.some((keyword) => blocked.has(keyword))) {
        return;
      }
      setNegativeKeywords(nextKeywords);
      scheduleSave(
        {
          domains,
          positiveKeywords,
          negativeKeywords: nextKeywords,
          targetSkus,
        },
        options,
      );
    },
    [domains, positiveKeywords, scheduleSave, targetSkus],
  );

  const handleTargetSkusChange = useCallback(
    (nextSkus: string[], options?: ChangeOptions) => {
      setTargetSkus(nextSkus);
      scheduleSave(
        {
          domains,
          positiveKeywords,
          negativeKeywords,
          targetSkus: nextSkus,
        },
        options,
      );
    },
    [domains, negativeKeywords, positiveKeywords, scheduleSave],
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
    positiveKeywords,
    negativeKeywords,
    targetSkus,
    saving,
    saveError,
    disabled: !enabled || channelId === null,
    handleDomainsChange,
    handlePositiveKeywordsChange,
    handleNegativeKeywordsChange,
    handleTargetSkusChange,
    handleAcceptDomain,
  };
}
