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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleWalmartRecordingUiChange(next: boolean) {
    setSaving(true);
    setSaveError(null);
    try {
      const settings = await getExtensionSettings();
      await saveExtensionSettings({ ...settings, walmart_recording_ui_enabled: next });
      await onRefresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="global-walmart-recording-ui-heading">
      <h2 id="global-walmart-recording-ui-heading" className="sr-only">
        Walmart recording visibility
      </h2>
      <EnableSlider
        id="popup-walmart-recording-ui"
        label="Show Walmart recording"
        checked={status.walmart_recording_ui_enabled}
        disabled={disabled || saving}
        onChange={(next) => void handleWalmartRecordingUiChange(next)}
      />
      {saving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
      {saveError && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
