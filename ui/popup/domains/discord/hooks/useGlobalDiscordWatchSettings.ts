import { useCallback, useEffect, useRef, useState } from "react";

import {
  getGlobalKeywords,
  getGlobalWatchSkus,
  upsertGlobalWatchSettings,
} from "@ext/core/lib/channel-targets.ts";
import { getExtensionSettings, saveExtensionSettings } from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";

const SAVE_DEBOUNCE_MS = 400;

type PendingSettings = {
  targetPositiveKeywords: string[];
  targetNegativeKeywords: string[];
  walmartPositiveKeywords: string[];
  walmartNegativeKeywords: string[];
  targetSkus: string[];
  walmartSkus: string[];
};

type ChangeOptions = {
  immediate?: boolean;
};

type GlobalWatchStatus = Pick<
  ExtensionStatus,
  | "global_target_positive_keywords"
  | "global_target_negative_keywords"
  | "global_walmart_positive_keywords"
  | "global_walmart_negative_keywords"
  | "global_target_skus"
  | "global_walmart_skus"
>;

function readGlobalWatchFromStatus(status: GlobalWatchStatus): PendingSettings {
  return {
    targetPositiveKeywords: status.global_target_positive_keywords,
    targetNegativeKeywords: status.global_target_negative_keywords,
    walmartPositiveKeywords: status.global_walmart_positive_keywords,
    walmartNegativeKeywords: status.global_walmart_negative_keywords,
    targetSkus: status.global_target_skus,
    walmartSkus: status.global_walmart_skus,
  };
}

export function useGlobalDiscordWatchSettings(
  enabled: boolean,
  status: GlobalWatchStatus | null,
) {
  const [targetPositiveKeywords, setTargetPositiveKeywords] = useState<string[]>(
    () => status?.global_target_positive_keywords ?? [],
  );
  const [targetNegativeKeywords, setTargetNegativeKeywords] = useState<string[]>(
    () => status?.global_target_negative_keywords ?? [],
  );
  const [walmartPositiveKeywords, setWalmartPositiveKeywords] = useState<string[]>(
    () => status?.global_walmart_positive_keywords ?? [],
  );
  const [walmartNegativeKeywords, setWalmartNegativeKeywords] = useState<string[]>(
    () => status?.global_walmart_negative_keywords ?? [],
  );
  const [targetSkus, setTargetSkus] = useState<string[]>(() => status?.global_target_skus ?? []);
  const [walmartSkus, setWalmartSkus] = useState<string[]>(
    () => status?.global_walmart_skus ?? [],
  );
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

  const loadSettings = useCallback(async () => {
    const settings = await getExtensionSettings();
    const targetKeywords = getGlobalKeywords(settings, "target");
    const walmartKeywords = getGlobalKeywords(settings, "walmart");
    setTargetPositiveKeywords(targetKeywords.positive);
    setTargetNegativeKeywords(targetKeywords.negative);
    setWalmartPositiveKeywords(walmartKeywords.positive);
    setWalmartNegativeKeywords(walmartKeywords.negative);
    setTargetSkus(getGlobalWatchSkus(settings, "target"));
    setWalmartSkus(getGlobalWatchSkus(settings, "walmart"));
  }, []);

  useEffect(() => {
    clearDebounce();
    if (!enabled) {
      setTargetPositiveKeywords([]);
      setTargetNegativeKeywords([]);
      setWalmartPositiveKeywords([]);
      setWalmartNegativeKeywords([]);
      setTargetSkus([]);
      setWalmartSkus([]);
      setSaveError(null);
      return;
    }
    if (status == null || saving || pendingRef.current !== null) {
      return;
    }
    const next = readGlobalWatchFromStatus(status);
    setTargetPositiveKeywords(next.targetPositiveKeywords);
    setTargetNegativeKeywords(next.targetNegativeKeywords);
    setWalmartPositiveKeywords(next.walmartPositiveKeywords);
    setWalmartNegativeKeywords(next.walmartNegativeKeywords);
    setTargetSkus(next.targetSkus);
    setWalmartSkus(next.walmartSkus);
  }, [clearDebounce, enabled, saving, status]);

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
        const settings = await getExtensionSettings();
        const next = upsertGlobalWatchSettings(settings, {
          target_positive_keywords: pending.targetPositiveKeywords,
          target_negative_keywords: pending.targetNegativeKeywords,
          walmart_positive_keywords: pending.walmartPositiveKeywords,
          walmart_negative_keywords: pending.walmartNegativeKeywords,
          target_skus: pending.targetSkus,
          walmart_skus: pending.walmartSkus,
        });
        await saveExtensionSettings(next);
        await loadSettings();
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
      targetPositiveKeywords,
      targetNegativeKeywords,
      walmartPositiveKeywords,
      walmartNegativeKeywords,
      targetSkus,
      walmartSkus,
    }),
    [
      targetNegativeKeywords,
      targetPositiveKeywords,
      targetSkus,
      walmartSkus,
      walmartNegativeKeywords,
      walmartPositiveKeywords,
    ],
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

  const handleWalmartSkusChange = useCallback(
    (nextSkus: string[], options?: ChangeOptions) => {
      setWalmartSkus(nextSkus);
      scheduleSave({ ...currentPending(), walmartSkus: nextSkus }, options);
    },
    [currentPending, scheduleSave],
  );

  return {
    targetPositiveKeywords,
    targetNegativeKeywords,
    walmartPositiveKeywords,
    walmartNegativeKeywords,
    targetSkus,
    walmartSkus,
    saving,
    saveError,
    handleTargetPositiveKeywordsChange,
    handleTargetNegativeKeywordsChange,
    handleWalmartPositiveKeywordsChange,
    handleWalmartNegativeKeywordsChange,
    handleTargetSkusChange,
    handleWalmartSkusChange,
  };
}
