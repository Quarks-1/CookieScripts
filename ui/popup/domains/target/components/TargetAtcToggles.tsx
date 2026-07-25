import type { AtcMode } from "@ext/core/lib/atc-mode.ts";
import { ATC_MODE_OPTIONS } from "@ext/core/lib/atc-mode.ts";
import type { RetailerAutoCheckoutMode } from "@ext/core/types/index.ts";
import { QuantitySegmentedField } from "@shared/components/QuantitySegmentedField.tsx";
import { SegmentedPillToggle } from "@shared/components/SegmentedPillToggle.tsx";
import { ThreeWayToggle } from "@shared/components/ThreeWayToggle.tsx";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";

const AUTO_CHECKOUT_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "sku_only", label: "SKU only" },
  { value: "all", label: "All" },
] as const satisfies readonly [
  { value: RetailerAutoCheckoutMode; label: string },
  { value: RetailerAutoCheckoutMode; label: string },
  { value: RetailerAutoCheckoutMode; label: string },
];

type TargetAtcTogglesProps = {
  atcMode: AtcMode;
  autoCheckoutMode: RetailerAutoCheckoutMode;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  autoCheckoutSaving: boolean;
  autoCheckoutSaveError: string | null;
  priceGateEnabled: boolean;
  priceGateSaving: boolean;
  priceGateSaveError: string | null;
  onAtcModeChange: (next: AtcMode) => void;
  onAutoCheckoutModeChange: (next: RetailerAutoCheckoutMode) => void;
  onPriceGateChange: (next: boolean) => void;
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

export function TargetAtcToggles({
  atcMode,
  autoCheckoutMode,
  disabled,
  saving,
  saveError,
  autoCheckoutSaving,
  autoCheckoutSaveError,
  priceGateEnabled,
  priceGateSaving,
  priceGateSaveError,
  onAtcModeChange,
  onAutoCheckoutModeChange,
  onPriceGateChange,
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
}: TargetAtcTogglesProps) {
  const controlsDisabled = disabled || saving;
  const autoCheckoutDisabled = disabled || autoCheckoutSaving;
  const priceGateDisabled = disabled || priceGateSaving || autoCheckoutMode === "off";
  const quantityInputDisabled = disabled || quantitySaving || effectiveUseMax;
  const maxToggleDisabled = disabled;

  return (
    <section aria-labelledby="target-atc-heading" className="mt-3 space-y-2">
      <h2 id="target-atc-heading" className="text-sm font-medium text-zinc-400">
        Add to cart
      </h2>
      <SegmentedPillToggle
        id="popup-atc-mode"
        label="ATC"
        value={atcMode}
        options={ATC_MODE_OPTIONS}
        trackClassName="w-[16rem]"
        disabled={controlsDisabled}
        onChange={onAtcModeChange}
      />
      <ThreeWayToggle
        id="popup-auto-checkout"
        label="Auto checkout"
        value={autoCheckoutMode}
        options={AUTO_CHECKOUT_OPTIONS}
        disabled={autoCheckoutDisabled}
        onChange={onAutoCheckoutModeChange}
      />
      <EnableSlider
        id="popup-price-gate"
        label="Price gate"
        checked={priceGateEnabled}
        disabled={priceGateDisabled}
        onChange={onPriceGateChange}
      />
      <QuantitySegmentedField
        id="popup-atc-quantity"
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
      {priceGateSaving && <p className="text-xs text-zinc-500">Saving price gate…</p>}
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
      {priceGateSaveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {priceGateSaveError}
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
