import { useCallback, useEffect, useRef, useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { setRetailerLinkOpenCount } from "@ext/domains/target/lib/channel-config.ts";

function parseOpenCountDraft(raw: string): number {
  if (raw.trim() === "") {
    return 1;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.floor(parsed)));
}

export function useRetailerLinkOpenCount(
  status: Pick<ExtensionStatus, "retailer_link_open_count"> | null,
  refresh: () => Promise<void>,
) {
  const [draftCount, setDraftCount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const lastSavedRef = useRef(1);

  useEffect(() => {
    if (status == null || focusedRef.current) {
      return;
    }
    const next = String(status.retailer_link_open_count);
    setDraftCount(next);
    lastSavedRef.current = status.retailer_link_open_count;
  }, [status]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const commit = useCallback(async () => {
    focusedRef.current = false;
    const normalized = parseOpenCountDraft(draftCount);
    setDraftCount(String(normalized));
    if (normalized === lastSavedRef.current) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings(setRetailerLinkOpenCount(settings, normalized));
      lastSavedRef.current = normalized;
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draftCount, refresh]);

  return {
    draftCount,
    setDraftCount,
    saving,
    saveError,
    commit,
    onFocus,
    disabled: saving,
  };
}
