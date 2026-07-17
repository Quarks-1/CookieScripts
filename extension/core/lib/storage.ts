import { HISTORY_LIMIT, RECENT_URL_LIMIT, STORAGE_KEYS } from "@ext/core/lib/constants.ts";
import { stripChannelWatchFields } from "@ext/core/lib/channel-targets.ts";
import { validateGlobalWatchSettings, validatePersistedTargets } from "@ext/core/lib/validate.ts";
import { DEFAULT_SETTINGS, type ExtensionSettings, type HistoryItem } from "@ext/core/types/index.ts";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const base = (result[STORAGE_KEYS.settings] as ExtensionSettings | undefined) ?? DEFAULT_SETTINGS;
  const stripped = stripChannelWatchFields(base);
  if (stripped.changed) {
    await saveSettings(stripped.settings);
  }
  return stripped.settings;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const targetsError = validatePersistedTargets(settings.channel_targets);
  if (targetsError) {
    throw new Error(targetsError);
  }
  const watchError = validateGlobalWatchSettings(settings);
  if (watchError) {
    throw new Error(watchError);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export async function getHistory(): Promise<HistoryItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.history);
  return (result[STORAGE_KEYS.history] as HistoryItem[] | undefined) ?? [];
}

export async function prependHistory(items: HistoryItem[]): Promise<void> {
  if (!items.length) {
    return;
  }
  const history = await getHistory();
  const merged = [...items, ...history].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [STORAGE_KEYS.history]: merged });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.history]: [],
    [STORAGE_KEYS.recentUrls]: [],
  });
}

export async function loadRecentUrls(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.recentUrls);
  return (result[STORAGE_KEYS.recentUrls] as string[] | undefined) ?? [];
}

export async function saveRecentUrls(urls: string[]): Promise<void> {
  const trimmed = urls.slice(-RECENT_URL_LIMIT);
  await chrome.storage.local.set({ [STORAGE_KEYS.recentUrls]: trimmed });
}

export async function seedDefaultsIfMissing(): Promise<void> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.history,
    STORAGE_KEYS.recentUrls,
  ]);
  const updates: Record<string, unknown> = {};
  if (result[STORAGE_KEYS.settings] === undefined) {
    updates[STORAGE_KEYS.settings] = DEFAULT_SETTINGS;
  }
  if (result[STORAGE_KEYS.history] === undefined) {
    updates[STORAGE_KEYS.history] = [];
  }
  if (result[STORAGE_KEYS.recentUrls] === undefined) {
    updates[STORAGE_KEYS.recentUrls] = [];
  }
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}
