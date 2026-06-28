export const RETAILER_AUTO_RESUME_KEY = "cookiescripts:retailerAutoResume";
export const RETAILER_AUTO_USER_STOPPED_KEY = "cookiescripts:retailerAutoUserStopped";

export type RetailerAutoResume = {
  channel_id: string;
  product_path: string;
  last_refresh_at: number;
};

export function productPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

export function readRetailerAutoResume(): RetailerAutoResume | null {
  try {
    const raw = sessionStorage.getItem(RETAILER_AUTO_RESUME_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as RetailerAutoResume;
    if (
      typeof parsed.channel_id !== "string" ||
      typeof parsed.product_path !== "string" ||
      typeof parsed.last_refresh_at !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveRetailerAutoResume(state: RetailerAutoResume): void {
  sessionStorage.setItem(RETAILER_AUTO_RESUME_KEY, JSON.stringify(state));
}

export function clearRetailerAutoResume(): void {
  sessionStorage.removeItem(RETAILER_AUTO_RESUME_KEY);
}

export function markRetailerAutoUserStopped(): void {
  sessionStorage.setItem(RETAILER_AUTO_USER_STOPPED_KEY, "1");
  clearRetailerAutoResume();
}

export function clearRetailerAutoUserStopped(): void {
  sessionStorage.removeItem(RETAILER_AUTO_USER_STOPPED_KEY);
}

export function isRetailerAutoUserStopped(): boolean {
  return sessionStorage.getItem(RETAILER_AUTO_USER_STOPPED_KEY) === "1";
}

export function ensureRetailerAutoResume(channelId: string, pageUrl: string): void {
  const productPath = productPathFromUrl(pageUrl);
  const existing = readRetailerAutoResume();
  if (existing && existing.product_path === productPath) {
    if (existing.channel_id !== channelId) {
      saveRetailerAutoResume({ ...existing, channel_id: channelId });
    }
    return;
  }

  startRetailerAutoResume(channelId, pageUrl);
}

export function startRetailerAutoResume(channelId: string, pageUrl: string): void {
  saveRetailerAutoResume({
    channel_id: channelId,
    product_path: productPathFromUrl(pageUrl),
    last_refresh_at: Date.now(),
  });
}

export function markRetailerAutoRefreshed(): void {
  const resume = readRetailerAutoResume();
  if (!resume) {
    return;
  }
  saveRetailerAutoResume({
    ...resume,
    last_refresh_at: Date.now(),
  });
}

export function shouldResumeRetailerAuto(pageUrl: string): RetailerAutoResume | null {
  if (isRetailerAutoUserStopped()) {
    return null;
  }
  const resume = readRetailerAutoResume();
  if (!resume) {
    return null;
  }
  if (productPathFromUrl(pageUrl) !== resume.product_path) {
    return null;
  }
  return resume;
}
