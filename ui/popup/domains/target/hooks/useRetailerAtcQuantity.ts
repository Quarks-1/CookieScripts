import { useCallback, useEffect, useRef, useState } from "react";

import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";
import { isEffectiveUseMax, isQuantityInvalid } from "@ext/domains/target/lib/quantity-limit.ts";

const SAVE_DEBOUNCE_MS = 400;

type QuantityStatus = Pick<
  ExtensionStatus,
  | "retailer_atc_quantity"
  | "retailer_use_max_quantity"
  | "retailer_purchase_limit"
  | "retailer_quantity_invalid"
>;

function parseQuantityDraft(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return Math.floor(parsed);
}

export function useRetailerAtcQuantity(
  retailerTabDetected: boolean,
  status: QuantityStatus | null,
) {
  const [quantity, setQuantity] = useState(1);
  const [useMaxQuantity, setUseMaxQuantity] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quantityFocusedRef = useRef(false);
  const lastSavedQuantityRef = useRef(1);
  const useMaxRef = useRef(false);

  const purchaseLimit = status?.retailer_purchase_limit ?? null;
  const effectiveUseMax = isEffectiveUseMax(useMaxQuantity, purchaseLimit);
  const draftParsed = parseQuantityDraft(draftQuantity);
  const draftInvalid =
    purchaseLimit != null &&
    !effectiveUseMax &&
    draftParsed != null &&
    isQuantityInvalid(draftParsed, purchaseLimit, false);

  useEffect(() => {
    if (!retailerTabDetected || status == null) {
      return;
    }
    if (!quantityFocusedRef.current) {
      setQuantity(status.retailer_atc_quantity);
      setDraftQuantity(String(status.retailer_atc_quantity));
      lastSavedQuantityRef.current = status.retailer_atc_quantity;
    }
    setUseMaxQuantity(status.retailer_use_max_quantity);
    useMaxRef.current = status.retailer_use_max_quantity;
  }, [retailerTabDetected, status]);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const saveQuantity = useCallback(
    async (nextQuantity: number, nextUseMax: boolean) => {
      setSaving(true);
      setSaveError(null);
      const prevQuantity = quantity;
      const prevUseMax = useMaxQuantity;
      setQuantity(nextQuantity);
      setUseMaxQuantity(nextUseMax);
      useMaxRef.current = nextUseMax;

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_RETAILER_ATC_QUANTITY",
          quantity: nextQuantity,
          use_max_quantity: nextUseMax,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        lastSavedQuantityRef.current = nextQuantity;
      } catch (err) {
        setQuantity(prevQuantity);
        setUseMaxQuantity(prevUseMax);
        useMaxRef.current = prevUseMax;
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [quantity, useMaxQuantity],
  );

  const scheduleQuantitySave = useCallback(
    (nextDraft: string) => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }

      const parsed = parseQuantityDraft(nextDraft);
      if (parsed == null) {
        return;
      }

      if (
        purchaseLimit != null &&
        !isEffectiveUseMax(useMaxRef.current, purchaseLimit) &&
        isQuantityInvalid(parsed, purchaseLimit, false)
      ) {
        return;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void saveQuantity(parsed, useMaxRef.current);
      }, SAVE_DEBOUNCE_MS);
    },
    [purchaseLimit, saveQuantity],
  );

  const handleQuantityChange = (raw: string) => {
    setDraftQuantity(raw);
    scheduleQuantitySave(raw);
  };

  const handleQuantityBlur = () => {
    quantityFocusedRef.current = false;
    const parsed = parseQuantityDraft(draftQuantity);
    if (parsed == null) {
      setDraftQuantity(String(lastSavedQuantityRef.current));
      return;
    }
    setDraftQuantity(String(parsed));
    if (draftInvalid) {
      return;
    }
    if (parsed !== lastSavedQuantityRef.current) {
      void saveQuantity(parsed, useMaxRef.current);
    }
  };

  const handleUseMaxChange = (next: boolean) => {
    const parsed = parseQuantityDraft(draftQuantity) ?? lastSavedQuantityRef.current;
    void saveQuantity(parsed, next);
  };

  const maxToggleChecked = useMaxQuantity;
  const showInvalidError =
    status?.retailer_quantity_invalid === true && !effectiveUseMax && purchaseLimit != null;

  return {
    draftQuantity,
    purchaseLimit,
    effectiveUseMax,
    maxToggleChecked,
    saving,
    saveError,
    draftInvalid,
    showInvalidError,
    handleQuantityChange,
    handleQuantityBlur,
    handleQuantityFocus: () => {
      quantityFocusedRef.current = true;
    },
    handleUseMaxChange,
  };
}
