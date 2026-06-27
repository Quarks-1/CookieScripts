import { DEFAULT_SETTINGS, type ExtensionSettings } from "@ext/types/index.ts";

export async function getSettings(): Promise<ExtensionSettings> {
  // Scaffold — chrome.storage wired in Phase 2
  return DEFAULT_SETTINGS;
}

export async function saveSettings(_settings: ExtensionSettings): Promise<void> {
  // Scaffold — chrome.storage wired in Phase 2
}
