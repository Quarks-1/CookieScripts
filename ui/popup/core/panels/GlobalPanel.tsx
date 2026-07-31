import { useState } from "react";

import {
  getExtensionSettingsSnapshot,
  saveExtensionSettings,
} from "@ext/core/lib/messages.ts";
import type { ExtensionStatus } from "@ext/core/types/index.ts";
import { EnableSlider } from "@shared/components/EnableSlider.tsx";
import { CatalogLaunchButton } from "@shared/components/CatalogLaunchButton.tsx";
import { useSettingsTransfer } from "../hooks/useSettingsTransfer.ts";

interface GlobalPanelProps {
  status: ExtensionStatus;
  disabled: boolean;
  onRefresh: () => Promise<void>;
}

export function GlobalPanel({ status, disabled, onRefresh }: GlobalPanelProps) {
  const {
    exporting,
    importing,
    transferBusy,
    message: transferMessage,
    messageTone,
    exportAllSettings,
    importAllSettings,
  } = useSettingsTransfer(onRefresh, {
    hasStoredCvv: status.samsclub_checkout_cvv.trim().length > 0,
  });

  const [openLinksInWindowSaving, setOpenLinksInWindowSaving] = useState(false);
  const [openLinksInWindowError, setOpenLinksInWindowError] = useState<string | null>(null);
  const [skuOpenModeSaving, setSkuOpenModeSaving] = useState(false);
  const [skuOpenModeError, setSkuOpenModeError] = useState<string | null>(null);
  const [discordAllowDuplicatesSaving, setDiscordAllowDuplicatesSaving] = useState(false);
  const [discordAllowDuplicatesError, setDiscordAllowDuplicatesError] = useState<string | null>(null);
  const [walmartRecordingUiSaving, setWalmartRecordingUiSaving] = useState(false);
  const [walmartRecordingUiError, setWalmartRecordingUiError] = useState<string | null>(null);
  const [samsclubRecordingUiSaving, setSamsclubRecordingUiSaving] = useState(false);
  const [samsclubRecordingUiError, setSamsclubRecordingUiError] = useState<string | null>(null);

  async function handleOpenLinksInWindowChange(next: boolean) {
    setOpenLinksInWindowSaving(true);
    setOpenLinksInWindowError(null);
    try {
      const { settings, importRevision } = await getExtensionSettingsSnapshot();
      await saveExtensionSettings({ ...settings, open_links_in_window: next }, importRevision);
      await onRefresh();
    } catch (err) {
      setOpenLinksInWindowError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setOpenLinksInWindowSaving(false);
    }
  }

  async function handleSkuOpenModeChange(next: boolean) {
    setSkuOpenModeSaving(true);
    setSkuOpenModeError(null);
    try {
      const { settings, importRevision } = await getExtensionSettingsSnapshot();
      await saveExtensionSettings({ ...settings, sku_open_mode_enabled: next }, importRevision);
      await onRefresh();
    } catch (err) {
      setSkuOpenModeError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSkuOpenModeSaving(false);
    }
  }

  async function handleDiscordAllowDuplicatesChange(next: boolean) {
    setDiscordAllowDuplicatesSaving(true);
    setDiscordAllowDuplicatesError(null);
    try {
      const { settings, importRevision } = await getExtensionSettingsSnapshot();
      await saveExtensionSettings(
        { ...settings, discord_allow_duplicates: next },
        importRevision,
      );
      await onRefresh();
    } catch (err) {
      setDiscordAllowDuplicatesError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setDiscordAllowDuplicatesSaving(false);
    }
  }

  async function handleWalmartRecordingUiChange(next: boolean) {
    setWalmartRecordingUiSaving(true);
    setWalmartRecordingUiError(null);
    try {
      const { settings, importRevision } = await getExtensionSettingsSnapshot();
      await saveExtensionSettings(
        { ...settings, walmart_recording_ui_enabled: next },
        importRevision,
      );
      await onRefresh();
    } catch (err) {
      setWalmartRecordingUiError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setWalmartRecordingUiSaving(false);
    }
  }

  async function handleSamsclubRecordingUiChange(next: boolean) {
    setSamsclubRecordingUiSaving(true);
    setSamsclubRecordingUiError(null);
    try {
      const { settings, importRevision } = await getExtensionSettingsSnapshot();
      await saveExtensionSettings(
        { ...settings, samsclub_recording_ui_enabled: next },
        importRevision,
      );
      await onRefresh();
    } catch (err) {
      setSamsclubRecordingUiError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSamsclubRecordingUiSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section aria-labelledby="global-sku-catalog-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="global-sku-catalog-heading" className="text-sm font-medium text-zinc-400">
            SKU catalog
          </h2>
          <CatalogLaunchButton disabled={disabled} />
        </div>
      </section>

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

      <section aria-labelledby="global-sku-open-mode-heading">
        <h2 id="global-sku-open-mode-heading" className="sr-only">
          SKU open mode
        </h2>
        <EnableSlider
          id="popup-sku-open-mode"
          label="SKU open mode"
          checked={status.sku_open_mode_enabled}
          disabled={disabled || skuOpenModeSaving}
          onChange={(next) => void handleSkuOpenModeChange(next)}
        />
        {skuOpenModeSaving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {skuOpenModeError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {skuOpenModeError}
          </p>
        )}
      </section>

      <section aria-labelledby="global-discord-allow-duplicates-heading">
        <h2 id="global-discord-allow-duplicates-heading" className="sr-only">
          Allow duplicate links
        </h2>
        <EnableSlider
          id="popup-discord-allow-duplicates"
          label="Allow duplicate links"
          checked={status.discord_allow_duplicates}
          disabled={disabled || discordAllowDuplicatesSaving}
          onChange={(next) => void handleDiscordAllowDuplicatesChange(next)}
        />
        {discordAllowDuplicatesSaving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {discordAllowDuplicatesError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {discordAllowDuplicatesError}
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

      <section aria-labelledby="global-samsclub-recording-ui-heading">
        <h2 id="global-samsclub-recording-ui-heading" className="sr-only">
          Sam&apos;s Club recording visibility
        </h2>
        <EnableSlider
          id="popup-samsclub-recording-ui"
          label="Show Sam's Club recording"
          checked={status.samsclub_recording_ui_enabled}
          disabled={disabled || samsclubRecordingUiSaving}
          onChange={(next) => void handleSamsclubRecordingUiChange(next)}
        />
        {samsclubRecordingUiSaving && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
        {samsclubRecordingUiError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-red-300">
            {samsclubRecordingUiError}
          </p>
        )}
      </section>

      <section aria-labelledby="global-settings-backup-heading">
        <h2 id="global-settings-backup-heading" className="text-sm font-medium text-zinc-400">
          Settings backup
        </h2>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
            disabled={disabled || transferBusy}
            onClick={() => void exportAllSettings()}
          >
            {exporting ? "Exporting…" : "Export all settings"}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
            disabled={disabled || transferBusy}
            onClick={() => void importAllSettings()}
          >
            {importing ? "Importing…" : "Import all settings"}
          </button>
        </div>
        {transferMessage && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-1 text-xs ${
              messageTone === "error"
                ? "text-red-300"
                : messageTone === "warning"
                  ? "text-amber-300"
                  : "text-zinc-500"
            }`}
          >
            {transferMessage}
          </p>
        )}
      </section>
    </div>
  );
}
