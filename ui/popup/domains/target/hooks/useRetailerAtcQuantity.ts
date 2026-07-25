import { useCallback, useEffect, useRef, useState } from "react";

import { sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";
import { isEffectiveUseMax, isQuantityInvalid } from "@ext/domains/target/lib/quantity-limit.ts";

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
  const [quantity, setQuantity] = useState(() => status?.retailer_atc_quantity ?? 1);
  const [useMaxQuantity, setUseMaxQuantity] = useState(
    () => status?.retailer_use_max_quantity ?? false,
  );
  const [draftQuantity, setDraftQuantity] = useState(() =>
    String(status?.retailer_atc_quantity ?? 1),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const quantityFocusedRef = useRef(false);
  const lastSavedQuantityRef = useRef(status?.retailer_atc_quantity ?? 1);
  const useMaxRef = useRef(status?.retailer_use_max_quantity ?? false);
  const pendingUseMaxRef = useRef<boolean | null>(null);

  const purchaseLimit = status?.retailer_purchase_limit ?? null;
  const effectiveUseMax = isEffectiveUseMax(useMaxQuantity, purchaseLimit);
  const draftParsed = parseQuantityDraft(draftQuantity);
  const draftInvalid =
    purchaseLimit != null &&
    !effectiveUseMax &&
    draftParsed != null &&
    isQuantityInvalid(draftParsed, purchaseLimit, false);

  useEffect(() => {
    if (!retailerTabDetected || status == null || saving) {
      return;
    }
    if (!quantityFocusedRef.current) {
      setQuantity(status.retailer_atc_quantity);
      setDraftQuantity(String(status.retailer_atc_quantity));
      lastSavedQuantityRef.current = status.retailer_atc_quantity;
    }

    const statusUseMax = status.retailer_use_max_quantity;
    if (pendingUseMaxRef.current !== null) {
      if (statusUseMax === pendingUseMaxRef.current) {
        pendingUseMaxRef.current = null;
        setUseMaxQuantity(statusUseMax);
        useMaxRef.current = statusUseMax;
      } else {
        setUseMaxQuantity(pendingUseMaxRef.current);
        useMaxRef.current = pendingUseMaxRef.current;
      }
      return;
    }

    setUseMaxQuantity(statusUseMax);
    useMaxRef.current = statusUseMax;
  }, [retailerTabDetected, status, saving]);

  const saveQuantity = useCallback(
    async (nextQuantity: number, nextUseMax: boolean) => {
      setSaving(true);
      setSaveError(null);
      const prevQuantity = quantity;
      const prevUseMax = useMaxQuantity;
      pendingUseMaxRef.current = nextUseMax;
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
        pendingUseMaxRef.current = null;
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

  const handleQuantityChange = (raw: string) => {
    setDraftQuantity(raw);
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
    if (next === useMaxRef.current) {
      return;
    }
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
