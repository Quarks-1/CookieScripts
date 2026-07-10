import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { CompactNumberField } from "@shared/components/CompactNumberField.tsx";

type TargetAtcTogglesProps = {
  frontendEnabled: boolean;
  backendEnabled: boolean;
  autoCheckoutEnabled: boolean;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  autoCheckoutSaving: boolean;
  autoCheckoutSaveError: string | null;
  onFrontendChange: (next: boolean) => void;
  onBackendChange: (next: boolean) => void;
  onAutoCheckoutChange: (next: boolean) => void;
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
  autoCheckoutEnabled,
  disabled,
  saving,
  saveError,
  autoCheckoutSaving,
  autoCheckoutSaveError,
  onFrontendChange,
  onBackendChange,
  onAutoCheckoutChange,
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
  const autoCheckoutDisabled = disabled || autoCheckoutSaving;
  const quantityInputDisabled = controlsDisabled || effectiveUseMax;
  const maxToggleDisabled = controlsDisabled || purchaseLimit == null;

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
      <EnableSlider
        id="popup-auto-checkout"
        label="Auto checkout"
        checked={autoCheckoutEnabled}
        disabled={autoCheckoutDisabled}
        onChange={onAutoCheckoutChange}
      />
      <CompactNumberField
        id="popup-atc-quantity"
        label="Quantity"
        description={purchaseLimit != null ? `Max: ${purchaseLimit}` : undefined}
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
      {purchaseLimit == null && (
        <p className="text-xs text-zinc-500">Max quantity unavailable on this page.</p>
      )}
      <p className="text-xs text-zinc-500">
        Frontend uses the page button. Backend uses the cart API.
      </p>
      <p className="text-xs text-zinc-500">
        Auto checkout requires a signed-in Target account with saved address and payment in this
        window.
      </p>
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
