import { useCallback, useEffect, useState } from "react";

import { STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { addIgnoredDomain } from "@ext/core/lib/ignored-domains.ts";
import { getDetectedDomains, saveChannelDomains } from "@ext/core/lib/messages.ts";

export function useDetectedLinks(
  channelId: string | null,
  enabled: boolean,
  allowedDomains: string[],
) {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || channelId === null) {
      setDomains([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detected = await getDetectedDomains();
      setDomains(detected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan page");
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [channelId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh, allowedDomains.join(",")]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (
        area !== "local" ||
        channelId === null ||
        (!changes[STORAGE_KEYS.ignoredDomains] && !changes[STORAGE_KEYS.settings])
      ) {
        return;
      }
      void refresh();
    }

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [channelId, refresh]);

  const handleAccept = useCallback(
    async (domain: string) => {
      if (channelId === null || !enabled) {
        return;
      }
      setActing(true);
      setError(null);
      try {
        await saveChannelDomains(channelId, [...allowedDomains, domain]);
        setDomains((current) => current.filter((d) => d !== domain));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add domain");
      } finally {
        setActing(false);
      }
    },
    [allowedDomains, channelId, enabled],
  );

  const handleDismiss = useCallback(
    async (domain: string) => {
      if (channelId === null || !enabled) {
        return;
      }
      setActing(true);
      setError(null);
      try {
        await addIgnoredDomain(channelId, domain);
        setDomains((current) => current.filter((d) => d !== domain));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to ignore domain");
      } finally {
        setActing(false);
      }
    },
    [channelId, enabled],
  );

  return {
    domains,
    loading,
    acting,
    error,
    disabled: !enabled || channelId === null,
    refresh,
    handleAccept,
    handleDismiss,
  };
}
