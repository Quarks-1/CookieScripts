import { useCallback, useEffect, useRef, useState } from "react";

import {
  getGlobalWatchSkus,
  upsertGlobalWatchSkus,
} from "@ext/core/lib/channel-targets.ts";
import {
  CLEAR_ALL_CONFIRM_MESSAGE,
  clearFirstPartyInGroup,
  selectAllFirstPartyInGroup,
  toggleFirstPartyCell,
  toggleMarketplaceListing,
} from "@ext/core/lib/catalog/index.ts";
import { MAX_SKUS_PER_LIST, STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import {
  getExtensionSettings,
  getExtensionSettingsSnapshot,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import type { CatalogCell, CatalogGroup, CatalogPickerRetailer } from "@ext/core/types/index.ts";

const SAVE_DEBOUNCE_MS = 400;

type PendingSkus = {
  target: string[];
  walmart: string[];
};

type ChangeOptions = {
  immediate?: boolean;
};

export function useCatalogSelection() {
  const [targetSkus, setTargetSkus] = useState<string[]>([]);
  const [walmartSkus, setWalmartSkus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [overflowMessage, setOverflowMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingSkus | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const loadSettings = useCallback(async () => {
    const settings = await getExtensionSettings();
    setTargetSkus(getGlobalWatchSkus(settings, "target"));
    setWalmartSkus(getGlobalWatchSkus(settings, "walmart"));
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") {
        return;
      }
      if (changes[STORAGE_KEYS.settingsImportRevision]) {
        clearDebounce();
        void loadSettings();
        return;
      }
      if (!changes[STORAGE_KEYS.settings]) {
        return;
      }
      if (saving || pendingRef.current !== null) {
        return;
      }
      void loadSettings();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [clearDebounce, loadSettings, saving]);

  useEffect(() => {
    return () => {
      clearDebounce();
    };
  }, [clearDebounce]);

  const flushSave = useCallback(async (pending: PendingSkus) => {
    setSaving(true);
    setSaveError(null);
    try {
      const { settings, importRevision } = await getExtensionSettingsSnapshot();
      const next = upsertGlobalWatchSkus(settings, {
        target: pending.target,
        walmart: pending.walmart,
      });
      await saveExtensionSettings(next, importRevision);
      await loadSettings();
    } catch {
      setSaveError("Couldn't save — try again");
    } finally {
      setSaving(false);
      pendingRef.current = null;
    }
  }, [loadSettings]);

  const scheduleSave = useCallback(
    (pending: PendingSkus, options?: ChangeOptions) => {
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
    (): PendingSkus => ({
      target: targetSkus,
      walmart: walmartSkus,
    }),
    [targetSkus, walmartSkus],
  );

  const applySkuChange = useCallback(
    (retailer: CatalogPickerRetailer, nextSkus: string[], options?: ChangeOptions) => {
      if (retailer === "target") {
        setTargetSkus(nextSkus);
      } else {
        setWalmartSkus(nextSkus);
      }
      const pending = currentPending();
      scheduleSave(
        {
          ...pending,
          [retailer]: nextSkus,
        },
        options,
      );
    },
    [currentPending, scheduleSave],
  );

  const toggleFirstParty = useCallback(
    (retailer: CatalogPickerRetailer, cell: CatalogCell) => {
      const current = retailer === "target" ? targetSkus : walmartSkus;
      const currentSet = new Set(current);
      const allSelected =
        cell !== null &&
        cell.firstParty.length > 0 &&
        cell.firstParty.every((entry) => currentSet.has(entry.listing.sku));

      if (!allSelected) {
        const unselected = cell?.firstParty.filter((entry) => !currentSet.has(entry.listing.sku)) ?? [];
        if (unselected.length > 0 && currentSet.size + unselected.length > MAX_SKUS_PER_LIST) {
          return;
        }
      }

      const nextSet = toggleFirstPartyCell(cell, currentSet);
      applySkuChange(retailer, [...nextSet]);
    },
    [applySkuChange, targetSkus, walmartSkus],
  );

  const toggleMarketplace = useCallback(
    (retailer: CatalogPickerRetailer, sku: string) => {
      const current = retailer === "target" ? targetSkus : walmartSkus;
      const currentSet = new Set(current);
      if (!currentSet.has(sku) && currentSet.size >= MAX_SKUS_PER_LIST) {
        return;
      }
      const nextSet = toggleMarketplaceListing(sku, currentSet);
      applySkuChange(retailer, [...nextSet]);
    },
    [applySkuChange, targetSkus, walmartSkus],
  );

  const selectAllInGroup = useCallback(
    (group: CatalogGroup, retailer: CatalogPickerRetailer) => {
      const current = retailer === "target" ? targetSkus : walmartSkus;
      const { skus, skipped } = selectAllFirstPartyInGroup(group, retailer, current);
      if (skipped > 0) {
        const label = retailer === "target" ? "Target" : "Walmart";
        setOverflowMessage(`Skipped ${skipped} ${label} SKU(s) — list is full.`);
      } else {
        setOverflowMessage(null);
      }
      applySkuChange(retailer, skus);
    },
    [applySkuChange, targetSkus, walmartSkus],
  );

  const clearGroup = useCallback(
    (group: CatalogGroup, retailer: CatalogPickerRetailer) => {
      const current = retailer === "target" ? targetSkus : walmartSkus;
      applySkuChange(retailer, clearFirstPartyInGroup(group, retailer, current));
    },
    [applySkuChange, targetSkus, walmartSkus],
  );

  const clearAll = useCallback(() => {
    if (!window.confirm(CLEAR_ALL_CONFIRM_MESSAGE)) {
      return;
    }
    setOverflowMessage(null);
    setTargetSkus([]);
    setWalmartSkus([]);
    scheduleSave({ target: [], walmart: [] }, { immediate: true });
  }, [scheduleSave]);

  const selectedSets = {
    target: new Set(targetSkus),
    walmart: new Set(walmartSkus),
  } as const;

  return {
    targetSkus,
    walmartSkus,
    selectedSets,
    saving,
    saveError,
    overflowMessage,
    toggleFirstParty,
    toggleMarketplace,
    selectAllInGroup,
    clearGroup,
    clearAll,
  };
}
