import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeDomain } from "@ext/core/lib/domains.ts";
import {
  getExtensionStatus,
  saveChannelDomains,
} from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";

const SAVE_DEBOUNCE_MS = 400;

type ChangeOptions = {
  immediate?: boolean;
};

type ChannelDomainsStatus = Pick<ExtensionStatus, "allowed_domains">;

export function useChannelDiscordSettings(
  channelId: string | null,
  enabled: boolean,
  status: ChannelDomainsStatus | null,
) {
  const [domains, setDomains] = useState<string[]>(() =>
    channelId !== null ? [...(status?.allowed_domains ?? [])] : [],
  );
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

  useEffect(() => {
    clearDebounce();
    if (channelId === null) {
      setDomains([]);
      setSaveError(null);
      return;
    }
    if (!saving && pendingDomainsRef.current === null) {
      setDomains([...(status?.allowed_domains ?? [])]);
    }
  }, [channelId, clearDebounce, status, saving]);

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
        const latestStatus = await getExtensionStatus();
        const saveChannelId = latestStatus.active_channel_id;
        if (saveChannelId === null) {
          return;
        }
        await saveChannelDomains(saveChannelId, nextDomains);
        setDomains(nextDomains);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
        pendingDomainsRef.current = null;
      }
    },
    [enabled],
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
