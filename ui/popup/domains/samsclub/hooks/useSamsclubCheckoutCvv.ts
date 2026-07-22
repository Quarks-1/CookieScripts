import { useCallback, useEffect, useRef, useState } from "react";

import { getSidePanelWindowId, sendToBackground } from "@ext/core/lib/messages.ts";
import type { BackgroundResponse, ExtensionStatus } from "@ext/core/types/index.ts";

const CVV_PATTERN = /^\d{3,4}$/;

function isValidCvvDraft(value: string): boolean {
  return value === "" || CVV_PATTERN.test(value);
}

type CheckoutCvvStatus = Pick<ExtensionStatus, "samsclub_checkout_cvv">;

export function useSamsclubCheckoutCvv(
  samsclubTabDetected: boolean,
  autoCheckoutEnabled: boolean,
  status: CheckoutCvvStatus | null,
) {
  const [draftCvv, setDraftCvv] = useState(() => status?.samsclub_checkout_cvv ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const focusedRef = useRef(false);

  const refresh = useCallback(async () => {
    const window_id = await getSidePanelWindowId();
    const response = await sendToBackground<BackgroundResponse>({ type: "GET_STATUS", window_id });
    if ("status" in response && response.ok) {
      if (!focusedRef.current) {
        setDraftCvv(response.status.samsclub_checkout_cvv ?? "");
      }
    }
  }, []);

  useEffect(() => {
    if (!samsclubTabDetected || status == null || focusedRef.current) {
      return;
    }
    setDraftCvv(status.samsclub_checkout_cvv ?? "");
  }, [samsclubTabDetected, status]);

  const saveCvv = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (trimmed !== "" && !CVV_PATTERN.test(trimmed)) {
        setSaveError("CVV must be 3 or 4 digits");
        return;
      }

      setSaving(true);
      setSaveError(null);
      setDraftCvv(trimmed);

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "SET_SAMSCLUB_CHECKOUT_CVV",
          cvv: trimmed,
        });
        if ("ok" in response && response.ok === false) {
          throw new Error(response.error);
        }
        await refresh();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Save failed");
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const handleChange = useCallback((next: string) => {
    const digitsOnly = next.replace(/\D/g, "").slice(0, 4);
    setDraftCvv(digitsOnly);
    if (saveError) {
      setSaveError(null);
    }
  }, [saveError]);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    if (!isValidCvvDraft(draftCvv)) {
      setSaveError("CVV must be 3 or 4 digits");
      return;
    }
    void saveCvv(draftCvv);
  }, [draftCvv, saveCvv]);

  const handleClear = useCallback(() => {
    void saveCvv("");
  }, [saveCvv]);

  const draftInvalid = draftCvv !== "" && !CVV_PATTERN.test(draftCvv);

  return {
    visible: autoCheckoutEnabled,
    draftCvv,
    saving,
    saveError,
    draftInvalid,
    handleChange,
    handleFocus,
    handleBlur,
    handleClear,
  };
}
