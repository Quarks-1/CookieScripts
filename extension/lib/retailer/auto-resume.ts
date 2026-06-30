import { isCheckoutAutomationUrl } from "@ext/lib/retailer/checkout/checkout-url.ts";

export const RETAILER_AUTO_RESUME_KEY = "cookiescripts:retailerAutoResume";
export const RETAILER_AUTO_USER_STOPPED_KEY = "cookiescripts:retailerAutoUserStopped";

export type RetailerAutoPhase = "pdp" | "checkout";

export type RetailerAutoResume = {
  channel_id: string;
  product_path: string;
  phase: RetailerAutoPhase;
  auto_checkout_enabled: boolean;
  last_refresh_at: number;
  last_checkout_progress_at: number;
};

type LegacyRetailerAutoResume = {
  channel_id: string;
  product_path: string;
  last_refresh_at: number;
  phase?: RetailerAutoPhase;
  auto_checkout_enabled?: boolean;
  last_checkout_progress_at?: number;
};

export function productPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function normalizeResume(parsed: LegacyRetailerAutoResume): RetailerAutoResume | null {
  if (
    typeof parsed.channel_id !== "string" ||
    typeof parsed.product_path !== "string" ||
    typeof parsed.last_refresh_at !== "number"
  ) {
    return null;
  }

  const lastRefreshAt = parsed.last_refresh_at;
  return {
    channel_id: parsed.channel_id,
    product_path: parsed.product_path,
    phase: parsed.phase === "checkout" ? "checkout" : "pdp",
    auto_checkout_enabled: parsed.auto_checkout_enabled === true,
    last_refresh_at: lastRefreshAt,
    last_checkout_progress_at:
      typeof parsed.last_checkout_progress_at === "number"
        ? parsed.last_checkout_progress_at
        : lastRefreshAt,
  };
}

export function readRetailerAutoResume(): RetailerAutoResume | null {
  try {
    const raw = sessionStorage.getItem(RETAILER_AUTO_RESUME_KEY);
    if (!raw) {
      return null;
    }
    return normalizeResume(JSON.parse(raw) as LegacyRetailerAutoResume);
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
  if (existing && existing.product_path === productPath && existing.phase === "pdp") {
    if (existing.channel_id !== channelId) {
      saveRetailerAutoResume({ ...existing, channel_id: channelId });
    }
    return;
  }

  if (existing?.phase === "checkout") {
    return;
  }

  startRetailerAutoResume(channelId, pageUrl);
}

export function startRetailerAutoResume(channelId: string, pageUrl: string): void {
  const now = Date.now();
  saveRetailerAutoResume({
    channel_id: channelId,
    product_path: productPathFromUrl(pageUrl),
    phase: "pdp",
    auto_checkout_enabled: false,
    last_refresh_at: now,
    last_checkout_progress_at: now,
  });
}

export function transitionRetailerAutoResumeToCheckout(
  channelId: string,
  pageUrl: string,
): void {
  const existing = readRetailerAutoResume();
  const now = Date.now();
  if (!existing) {
    saveRetailerAutoResume({
      channel_id: channelId,
      product_path: productPathFromUrl(pageUrl),
      phase: "checkout",
      auto_checkout_enabled: true,
      last_refresh_at: now,
      last_checkout_progress_at: now,
    });
    return;
  }

  saveRetailerAutoResume({
    ...existing,
    channel_id: channelId,
    phase: "checkout",
    auto_checkout_enabled: true,
    last_checkout_progress_at: now,
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

export function markCheckoutProgress(): void {
  const resume = readRetailerAutoResume();
  if (!resume) {
    return;
  }
  saveRetailerAutoResume({
    ...resume,
    last_checkout_progress_at: Date.now(),
  });
}

export function shouldResumeRetailerAuto(pageUrl: string): RetailerAutoResume | null {
  if (isRetailerAutoUserStopped()) {
    return null;
  }
  const resume = readRetailerAutoResume();
  if (!resume || resume.phase !== "pdp") {
    return null;
  }
  if (productPathFromUrl(pageUrl) !== resume.product_path) {
    return null;
  }
  return resume;
}

export function shouldResumeRetailerCheckout(pageUrl: string): RetailerAutoResume | null {
  if (isRetailerAutoUserStopped()) {
    return null;
  }
  const resume = readRetailerAutoResume();
  if (!resume || resume.phase !== "checkout" || !resume.auto_checkout_enabled) {
    return null;
  }

  if (isCheckoutAutomationUrl(pageUrl)) {
    return resume;
  }

  return null;
}
