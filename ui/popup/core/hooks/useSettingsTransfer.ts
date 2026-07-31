import { useCallback, useState } from "react";

import {
  exportSettingsBlob,
  importSettingsBlob,
  validateSettingsBlob,
} from "@ext/core/lib/messages.ts";
import type { SettingsImportSummary } from "@ext/core/types/index.ts";

const CVV_EXPORT_CONFIRM =
  "This backup includes your saved Sam's Club CVV and will copy it as plain text. Continue?";

function formatImportConfirm(summary: SettingsImportSummary, hasStoredCvv: boolean): string {
  const schedules =
    summary.enabled_schedules.length > 0
      ? summary.enabled_schedules.join(", ")
      : "None";
  const lines = [
    `Extension: ${summary.enabled ? "enabled" : "disabled"}`,
    `Discord channels: ${summary.discord_channel_count}`,
    `Target SKUs: ${summary.target_sku_count}`,
    `Walmart SKUs: ${summary.walmart_sku_count}`,
    `Enabled schedules: ${schedules}`,
    `CVV: ${summary.contains_cvv ? "included" : "not included"}`,
  ];
  if (!summary.contains_cvv && hasStoredCvv) {
    lines.push("Your saved Sam's Club CVV will be removed.");
  }
  lines.push("", "This replaces all current settings and cannot be undone.");
  return lines.join("\n");
}

export function useSettingsTransfer(
  onRefresh: () => Promise<void>,
  options?: { hasStoredCvv?: boolean },
) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "error">("success");

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const setStatus = useCallback((text: string, tone: "success" | "warning" | "error") => {
    setMessage(text);
    setMessageTone(tone);
  }, []);

  const exportAllSettings = useCallback(async () => {
    clearMessage();
    setExporting(true);
    try {
      const { settings_blob, contains_cvv } = await exportSettingsBlob();
      if (contains_cvv && !window.confirm(CVV_EXPORT_CONFIRM)) {
        return;
      }
      await navigator.clipboard.writeText(settings_blob);
      setStatus("All settings copied to clipboard.", "success");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }, [clearMessage, setStatus]);

  const importAllSettings = useCallback(async () => {
    clearMessage();
    setImporting(true);
    try {
      const blob = await navigator.clipboard.readText();
      const summary = await validateSettingsBlob(blob);
      const hasStoredCvv = options?.hasStoredCvv === true;
      if (!window.confirm(formatImportConfirm(summary, hasStoredCvv))) {
        return;
      }
      const result = await importSettingsBlob(blob);
      await onRefresh();
      if (result.warning) {
        setStatus(result.warning, "warning");
      } else {
        setStatus("All settings imported.", "success");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }, [clearMessage, onRefresh, options?.hasStoredCvv, setStatus]);

  return {
    exporting,
    importing,
    transferBusy: exporting || importing,
    message,
    messageTone,
    exportAllSettings,
    importAllSettings,
  };
}
