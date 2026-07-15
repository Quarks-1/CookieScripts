import { useState } from "react";

import {
  getExtensionSettings,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";

interface GlobalPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function GlobalPanel({ status, disabled, onRefresh }: GlobalPanelProps) {
  const [openLinksInWindowSaving, setOpenLinksInWindowSaving] = useState(false);
  const [openLinksInWindowError, setOpenLinksInWindowError] = useState<string | null>(null);
  const [walmartRecordingUiSaving, setWalmartRecordingUiSaving] = useState(false);
  const [walmartRecordingUiError, setWalmartRecordingUiError] = useState<string | null>(null);

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

  async function handleWalmartRecordingUiChange(next: boolean) {
    setWalmartRecordingUiSaving(true);
    setWalmartRecordingUiError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings({ ...settings, walmart_recording_ui_enabled: next });
      await onRefresh();
    } catch (err) {
      setWalmartRecordingUiError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setWalmartRecordingUiSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section aria-labelledby="global-open-links-in-window-heading">
        <h2 id="global-open-links-in-window-heading" className="sr-only">
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

      <section aria-labelledby="global-walmart-recording-ui-heading">
        <h2 id="global-walmart-recording-ui-heading" className="sr-only">
          Walmart recording visibility
        </h2>
        <EnableSlider
          id="popup-walmart-recording-ui"
          label="Show Walmart recording"
          checked={status.walmart_recording_ui_enabled}
          disabled={disabled || walmartRecordingUiSaving}
          onChange={(next) => void handleWalmartRecordingUiChange(next)}
        />
        {walmartRecordingUiSaving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {walmartRecordingUiError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {walmartRecordingUiError}
          </p>
        )}
      </section>
    </div>
  );
}
