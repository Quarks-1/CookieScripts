import { EnableSlider } from "@shared/components/EnableSlider.tsx";

type TargetAtcTogglesProps = {
  frontendEnabled: boolean;
  backendEnabled: boolean;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  onFrontendChange: (next: boolean) => void;
  onBackendChange: (next: boolean) => void;
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
  disabled,
  saving,
  saveError,
  onFrontendChange,
  onBackendChange,
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
      <div className="flex items-end justify-between gap-2">
        <label className="block text-xs text-zinc-500" htmlFor="popup-atc-quantity">
          Quantity
        </label>
        {purchaseLimit != null && (
          <span className="text-xs text-zinc-500">Max: {purchaseLimit}</span>
        )}
      </div>
      <input
        id="popup-atc-quantity"
        type="number"
        min={1}
        step={1}
        value={quantityDraft}
        disabled={quantityInputDisabled}
        onFocus={onQuantityFocus}
        onChange={(event) => onQuantityChange(event.target.value)}
        onBlur={onQuantityBlur}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
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
      {saving && <p className="text-xs text-zinc-500">Saving…</p>}
      {quantitySaving && <p className="text-xs text-zinc-500">Saving quantity…</p>}
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
    </section>
  );
}
