import type { RetailerProfile, RetailerProfilesStore } from "@ext/types/retailer.ts";

const MAX_PROFILE_BYTES = 50_000;

export function validateRetailerProfile(profile: unknown): string | null {
  if (profile === null) {
    return null;
  }
  if (typeof profile !== "object" || profile === null) {
    return "Profile must be an object";
  }
  const p = profile as RetailerProfile;
  if (p.profile_version !== 1) {
    return "Unsupported profile version";
  }
  if (p.host !== "target.com") {
    return "Unsupported retailer host";
  }
  if (!Array.isArray(p.steps) || !Array.isArray(p.descriptors)) {
    return "Profile steps and descriptors must be arrays";
  }
  if (JSON.stringify(profile).length > MAX_PROFILE_BYTES) {
    return "Profile exceeds size limit";
  }
  return null;
}

export function validateRetailerProfilesStore(store: unknown): string | null {
  if (store === null || store === undefined) {
    return null;
  }
  if (typeof store !== "object") {
    return "Profiles store must be an object";
  }
  const s = store as RetailerProfilesStore;
  if (s.target !== null && s.target !== undefined) {
    return validateRetailerProfile(s.target);
  }
  return null;
}
