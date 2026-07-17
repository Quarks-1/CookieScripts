import type { RetailerAutoCheckoutMode } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { CompactNumberField } from "@shared/components/CompactNumberField.tsx";
import { ThreeWayToggle } from "@shared/components/ThreeWayToggle.tsx";

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
  frontendEnabled: boolean;
  backendEnabled: boolean;
  autoCheckoutMode: RetailerAutoCheckoutMode;
  autoAtcEnabled: boolean;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  autoCheckoutSaving: boolean;
  autoCheckoutSaveError: string | null;
  onFrontendChange: (next: boolean) => void;
  onBackendChange: (next: boolean) => void;
  onAutoCheckoutModeChange: (next: RetailerAutoCheckoutMode) => void;
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
  frontendEnabled,
  backendEnabled,
  autoCheckoutMode,
  autoAtcEnabled,
  disabled,
  saving,
  saveError,
  autoCheckoutSaving,
  autoCheckoutSaveError,
  onFrontendChange,
  onBackendChange,
  onAutoCheckoutModeChange,
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
  const controlsDisabled = disabled || saving || quantitySaving;
  const autoCheckoutDisabled = disabled || autoCheckoutSaving || !autoAtcEnabled;
  const quantityInputDisabled = controlsDisabled || effectiveUseMax;
  const maxToggleDisabled = controlsDisabled;

  return (
    <section aria-labelledby="target-atc-heading" className="mt-3 space-y-2">
      <h2 id="target-atc-heading" className="text-sm font-medium text-zinc-400">
        Add to cart
      </h2>
      <EnableSlider
        id="popup-frontend-atc"
        label="Frontend ATC"
        checked={frontendEnabled}
        disabled={controlsDisabled}
        onChange={onFrontendChange}
      />
      <EnableSlider
        id="popup-backend-atc"
        label="Backend ATC"
        checked={backendEnabled}
        disabled={controlsDisabled}
        onChange={onBackendChange}
      />
      <ThreeWayToggle
        id="popup-auto-checkout"
        label="Auto checkout"
        value={autoCheckoutMode}
        options={AUTO_CHECKOUT_OPTIONS}
        disabled={autoCheckoutDisabled}
        onChange={onAutoCheckoutModeChange}
      />
      <CompactNumberField
        id="popup-atc-quantity"
        label="Quantity"
        min={1}
        step={1}
        value={quantityDraft}
        disabled={quantityInputDisabled}
        onFocus={onQuantityFocus}
        onChange={onQuantityChange}
        onBlur={onQuantityBlur}
      />
      <EnableSlider
        id="popup-max-quantity"
        label="Max quantity"
        checked={maxToggleChecked}
        disabled={maxToggleDisabled}
        onChange={onUseMaxChange}
      />
      {autoCheckoutSaving && <p className="text-xs text-zinc-500">Saving auto checkout…</p>}
      {saving && <p className="text-xs text-zinc-500">Saving ATC modes…</p>}
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
      {quantitySaving && <p className="text-xs text-zinc-500">Saving quantity…</p>}
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
