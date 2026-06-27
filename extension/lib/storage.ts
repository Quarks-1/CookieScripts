import { HISTORY_LIMIT, RECENT_URL_LIMIT, STORAGE_KEYS } from "@ext/lib/constants.ts";
import { validateRetailerProfilesStore } from "@ext/lib/retailer/validate-profile.ts";
import { validatePersistedTargets } from "@ext/lib/validate.ts";
import { DEFAULT_SETTINGS, type ExtensionSettings, type HistoryItem } from "@ext/types/index.ts";
import type { RetailerProfile, RetailerProfilesStore } from "@ext/types/retailer.ts";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return (result[STORAGE_KEYS.settings] as ExtensionSettings | undefined) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const error = validatePersistedTargets(settings.channel_targets);
  if (error) {
    throw new Error(error);
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
    STORAGE_KEYS.retailerProfiles,
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
  if (result[STORAGE_KEYS.retailerProfiles] === undefined) {
    updates[STORAGE_KEYS.retailerProfiles] = { target: null };
  }
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

const DEFAULT_PROFILES_STORE: RetailerProfilesStore = { target: null };

export async function getRetailerProfiles(): Promise<RetailerProfilesStore> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.retailerProfiles);
  return (
    (result[STORAGE_KEYS.retailerProfiles] as RetailerProfilesStore | undefined) ??
    DEFAULT_PROFILES_STORE
  );
}

export async function saveRetailerProfile(profile: RetailerProfile | null): Promise<void> {
  const store: RetailerProfilesStore = { target: profile };
  const error = validateRetailerProfilesStore(store);
  if (error) {
    throw new Error(error);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.retailerProfiles]: store });
}

export async function clearRetailerProfile(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.retailerProfiles]: DEFAULT_PROFILES_STORE });
}
