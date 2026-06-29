import { EnableSlider } from "@shared/components/EnableSlider.tsx";

type TargetAtcTogglesProps = {
  frontendEnabled: boolean;
  backendEnabled: boolean;
  disabled: boolean;
  saving: boolean;
  saveError: string | null;
  onFrontendChange: (next: boolean) => void;
  onBackendChange: (next: boolean) => void;
};

export function TargetAtcToggles({
  frontendEnabled,
  backendEnabled,
  disabled,
  saving,
  saveError,
  onFrontendChange,
  onBackendChange,
}: TargetAtcTogglesProps) {
  const controlsDisabled = disabled || saving;

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
      <p className="text-xs text-zinc-500">
        Frontend uses the page button. Backend uses the cart API.
      </p>
      {saving && <p className="text-xs text-zinc-500">Saving…</p>}
      {saveError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
