import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { VersionStatus } from "./VersionStatus.tsx";

interface UpdateCheckState {
  installedVersion: string;
  checking: boolean;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

interface SidepanelHeaderProps {
  status: ExtensionStatus | null;
  enabling: boolean;
  enableError: string | null;
  onEnabledChange: (next: boolean) => void;
  updateCheck: UpdateCheckState;
}

export function SidepanelHeader({
  status,
  enabling,
  enableError,
  onEnabledChange,
  updateCheck,
}: SidepanelHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">CookieScripts</h1>
        <VersionStatus
          installedVersion={updateCheck.installedVersion}
          checking={updateCheck.checking}
          updateAvailable={updateCheck.updateAvailable}
          releaseUrl={updateCheck.releaseUrl}
        />
      </div>

      <section aria-labelledby="popup-enable-heading" className="mt-3">
        <h2 id="popup-enable-heading" className="sr-only">
          Extension enabled
        </h2>
        {status !== null ? (
          <EnableSlider
            id="popup-global-enabled"
            checked={status.enabled}
            disabled={enabling}
            onChange={(next) => onEnabledChange(next)}
          />
        ) : (
          <label className="flex cursor-wait items-center justify-between gap-3 text-sm opacity-60">
            <span className="text-zinc-300">Enable extension</span>
            <span
              aria-hidden="true"
              className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-zinc-800"
            />
          </label>
        )}
        {enabling && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {enableError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {enableError}
          </p>
        )}
      </section>
    </>
  );
}
