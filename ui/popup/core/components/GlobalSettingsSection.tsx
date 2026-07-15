import { useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";

interface GlobalSettingsSectionProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function GlobalSettingsSection({
  status,
  disabled,
  onRefresh,
}: GlobalSettingsSectionProps) {
  const [openLinksInWindowSaving, setOpenLinksInWindowSaving] = useState(false);
  const [openLinksInWindowError, setOpenLinksInWindowError] = useState<string | null>(null);

  async function handleOpenLinksInWindowChange(next: boolean) {
    setOpenLinksInWindowSaving(true);
    setOpenLinksInWindowError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings({ ...settings, open_links_in_window: next });
      await onRefresh();
    } catch (err) {
      setOpenLinksInWindowError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setOpenLinksInWindowSaving(false);
    }
  }

  return (
    <section aria-labelledby="popup-open-links-in-window-heading" className="mt-3">
      <h2 id="popup-open-links-in-window-heading" className="sr-only">
        Open links in new window
      </h2>
      <EnableSlider
        id="popup-open-links-in-window"
        label="Open links in new window"
        checked={status.open_links_in_window}
        disabled={disabled || openLinksInWindowSaving}
        onChange={(next) => void handleOpenLinksInWindowChange(next)}
      />
      {openLinksInWindowSaving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
      {openLinksInWindowError && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
          {openLinksInWindowError}
        </p>
      )}
    </section>
  );
}
