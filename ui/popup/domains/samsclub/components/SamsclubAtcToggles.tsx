import type { AtcMode } from "@ext/core/lib/atc-mode.ts";
import { ATC_MODE_OPTIONS } from "@ext/core/lib/atc-mode.ts";
import type { SamsclubAutoCheckoutMode } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { QuantitySegmentedField } from "@shared/components/QuantitySegmentedField.tsx";
import { SegmentedPillToggle } from "@shared/components/SegmentedPillToggle.tsx";

type SamsclubAtcTogglesProps = {
  atcMode: AtcMode;
  autoCheckoutMode: SamsclubAutoCheckoutMode;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  autoCheckoutSaving: boolean;
  autoCheckoutSaveError: string | null;
  onAtcModeChange: (next: AtcMode) => void;
  onAutoCheckoutModeChange: (next: SamsclubAutoCheckoutMode) => void;
  checkoutCvvVisible: boolean;
  checkoutCvvDraft: string;
  checkoutCvvSaving: boolean;
  checkoutCvvSaveError: string | null;
  checkoutCvvDraftInvalid: boolean;
  onCheckoutCvvChange: (next: string) => void;
  onCheckoutCvvFocus: () => void;
  onCheckoutCvvBlur: () => void;
  onCheckoutCvvClear: () => void;
  quantityDraft: string;
  purchaseLimit: number | null;
  effectiveUseMax: boolean;
  maxToggleChecked: boolean;
  quantitySaving: boolean;
  quantitySaveError: string | null;
  draftInvalid: boolean;
  showInvalidError: boolean;
  onQuantityChange: (next: string) => void;
  onQuantityBlur: () => void;
  onQuantityFocus: () => void;
  onUseMaxChange: (next: boolean) => void;
};

export function SamsclubAtcToggles({
  atcMode,
  autoCheckoutMode,
  disabled,
  saving,
  saveError,
  autoCheckoutSaving,
  autoCheckoutSaveError,
  onAtcModeChange,
  onAutoCheckoutModeChange,
  checkoutCvvVisible,
  checkoutCvvDraft,
  checkoutCvvSaving,
  checkoutCvvSaveError,
  checkoutCvvDraftInvalid,
  onCheckoutCvvChange,
  onCheckoutCvvFocus,
  onCheckoutCvvBlur,
  onCheckoutCvvClear,
  quantityDraft,
  purchaseLimit,
  effectiveUseMax,
  maxToggleChecked,
  quantitySaving,
  quantitySaveError,
  draftInvalid,
  showInvalidError,
  onQuantityChange,
  onQuantityBlur,
  onQuantityFocus,
  onUseMaxChange,
}: SamsclubAtcTogglesProps) {
  const controlsDisabled = disabled || saving;
  const autoCheckoutDisabled = disabled || autoCheckoutSaving;
  const quantityInputDisabled = disabled || quantitySaving || effectiveUseMax;
  const maxToggleDisabled = disabled;

  return (
    <section aria-labelledby="samsclub-atc-heading" className="mt-3 space-y-2">
      <h2 id="samsclub-atc-heading" className="text-sm font-medium text-zinc-400">
        Add to cart
      </h2>
      <SegmentedPillToggle
        id="popup-samsclub-atc-mode"
        label="ATC"
        value={atcMode}
        options={ATC_MODE_OPTIONS}
        trackClassName="w-[16rem]"
        disabled={controlsDisabled}
        onChange={onAtcModeChange}
      />
      <EnableSlider
        id="popup-samsclub-auto-checkout"
        label="Auto checkout"
        checked={autoCheckoutMode === "all"}
        disabled={autoCheckoutDisabled}
        onChange={(next) => onAutoCheckoutModeChange(next ? "all" : "off")}
      />
      {checkoutCvvVisible && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="popup-samsclub-checkout-cvv" className="text-sm text-zinc-300">
              CVV (required for checkout)
            </label>
            <input
              id="popup-samsclub-checkout-cvv"
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              value={checkoutCvvDraft}
              disabled={autoCheckoutDisabled || checkoutCvvSaving}
              onFocus={onCheckoutCvvFocus}
              onChange={(event) => onCheckoutCvvChange(event.target.value)}
              onBlur={onCheckoutCvvBlur}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Sam&apos;s Club requires CVV on every order, even for saved cards.
          </p>
          <button
            type="button"
            disabled={autoCheckoutDisabled || checkoutCvvSaving || checkoutCvvDraft === ""}
            onClick={onCheckoutCvvClear}
            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50"
          >
            Clear CVV
          </button>
          {checkoutCvvSaving && <p className="text-xs text-zinc-500">Saving CVV…</p>}
          {checkoutCvvDraftInvalid && (
            <p role="status" aria-live="polite" className="text-xs text-red-300">
              CVV must be 3 or 4 digits
            </p>
          )}
          {checkoutCvvSaveError && (
            <p role="status" aria-live="polite" className="text-xs text-red-300">
              {checkoutCvvSaveError}
            </p>
          )}
        </div>
      )}
      <QuantitySegmentedField
        id="popup-samsclub-atc-quantity"
        label="Quantity"
        min={1}
        step={1}
        value={quantityDraft}
        useMax={maxToggleChecked}
        quantityDisabled={quantityInputDisabled}
        maxDisabled={maxToggleDisabled}
        onFocus={onQuantityFocus}
        onChange={onQuantityChange}
        onBlur={onQuantityBlur}
        onUseMaxChange={onUseMaxChange}
      />
      {autoCheckoutSaving && <p className="text-xs text-zinc-500">Saving auto checkout…</p>}
      {saving && <p className="text-xs text-zinc-500">Saving ATC…</p>}
      {showInvalidError && purchaseLimit != null && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          Quantity cannot exceed max ({purchaseLimit})
        </p>
      )}
      {draftInvalid && !showInvalidError && purchaseLimit != null && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          Quantity cannot exceed max ({purchaseLimit})
        </p>
      )}
      {saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {saveError}
        </p>
      )}
      {quantitySaveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {quantitySaveError}
        </p>
      )}
      {autoCheckoutSaveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {autoCheckoutSaveError}
        </p>
      )}
    </section>
  );
}
