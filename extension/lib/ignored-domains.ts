import { STORAGE_KEYS } from "@ext/lib/constants.ts";
import { normalizeDomain } from "@ext/lib/domains.ts";

export type IgnoredDomainsMap = Record<string, string[]>;

export async function getIgnoredDomainsMap(): Promise<IgnoredDomainsMap> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ignoredDomains);
  return (result[STORAGE_KEYS.ignoredDomains] as IgnoredDomainsMap | undefined) ?? {};
}

export async function getIgnoredDomains(channelId: string): Promise<string[]> {
  const map = await getIgnoredDomainsMap();
  return map[channelId] ?? [];
}

export async function addIgnoredDomain(channelId: string, domain: string): Promise<void> {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return;
  }
  const map = await getIgnoredDomainsMap();
  const current = map[channelId] ?? [];
  if (current.includes(normalized)) {
    return;
  }
  map[channelId] = [...current, normalized];
  await chrome.storage.local.set({ [STORAGE_KEYS.ignoredDomains]: map });
}
