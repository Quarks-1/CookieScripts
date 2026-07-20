import { isCheckoutAutomationUrl } from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";

export const SAMSCLUB_AUTO_RESUME_KEY = "cookiescripts:samsclubAutoResume";
export const SAMSCLUB_AUTO_USER_STOPPED_KEY = "cookiescripts:samsclubAutoUserStopped";
export const SAMSCLUB_CHECKOUT_NAV_GRACE_KEY = "cookiescripts:samsclubCheckoutNavGrace";

/** Allow SPA hops (cart → checkout) before treating navigation as abandon. */
export const CHECKOUT_NAV_GRACE_MS = 30_000;

export type SamsclubAutoPhase = "pdp" | "checkout";

export type SamsclubAutoResume = {
  channel_id: string;
  product_path: string;
  phase: SamsclubAutoPhase;
  auto_checkout_enabled: boolean;
  last_refresh_at: number;
  last_checkout_progress_at: number;
};

type LegacySamsclubAutoResume = {
  channel_id: string;
  product_path: string;
  last_refresh_at: number;
  phase?: SamsclubAutoPhase;
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

function normalizeResume(parsed: LegacySamsclubAutoResume): SamsclubAutoResume | null {
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

export function readSamsclubAutoResume(): SamsclubAutoResume | null {
  try {
    const raw = sessionStorage.getItem(SAMSCLUB_AUTO_RESUME_KEY);
    if (!raw) {
      return null;
    }
    return normalizeResume(JSON.parse(raw) as LegacySamsclubAutoResume);
  } catch {
    return null;
  }
}

export function saveSamsclubAutoResume(state: SamsclubAutoResume): void {
  sessionStorage.setItem(SAMSCLUB_AUTO_RESUME_KEY, JSON.stringify(state));
}

export function clearSamsclubAutoResume(): void {
  sessionStorage.removeItem(SAMSCLUB_AUTO_RESUME_KEY);
}

export function markSamsclubAutoUserStopped(): void {
  sessionStorage.setItem(SAMSCLUB_AUTO_USER_STOPPED_KEY, "1");
  clearSamsclubAutoResume();
}

export function clearSamsclubAutoUserStopped(): void {
  sessionStorage.removeItem(SAMSCLUB_AUTO_USER_STOPPED_KEY);
}

export function markCheckoutNavigationStarted(
  graceMs = CHECKOUT_NAV_GRACE_MS,
): void {
  sessionStorage.setItem(
    SAMSCLUB_CHECKOUT_NAV_GRACE_KEY,
    String(Date.now() + graceMs),
  );
}

export function isWithinCheckoutNavigationGrace(): boolean {
  const raw = sessionStorage.getItem(SAMSCLUB_CHECKOUT_NAV_GRACE_KEY);
  if (!raw) {
    return false;
  }
  const until = Number(raw);
  if (!Number.isFinite(until) || Date.now() > until) {
    sessionStorage.removeItem(SAMSCLUB_CHECKOUT_NAV_GRACE_KEY);
    return false;
  }
  return true;
}

export function clearCheckoutNavigationGrace(): void {
  sessionStorage.removeItem(SAMSCLUB_CHECKOUT_NAV_GRACE_KEY);
}

export function isSamsclubAutoUserStopped(): boolean {
  return sessionStorage.getItem(SAMSCLUB_AUTO_USER_STOPPED_KEY) === "1";
}

export function ensureSamsclubAutoResume(channelId: string, pageUrl: string): void {
  const productPath = productPathFromUrl(pageUrl);
  const existing = readSamsclubAutoResume();
  if (existing && existing.product_path === productPath && existing.phase === "pdp") {
    if (existing.channel_id !== channelId) {
      saveSamsclubAutoResume({ ...existing, channel_id: channelId });
    }
    return;
  }

  if (existing?.phase === "checkout") {
    return;
  }

  startSamsclubAutoResume(channelId, pageUrl);
}

export function startSamsclubAutoResume(channelId: string, pageUrl: string): void {
  const now = Date.now();
  saveSamsclubAutoResume({
    channel_id: channelId,
    product_path: productPathFromUrl(pageUrl),
    phase: "pdp",
    auto_checkout_enabled: false,
    last_refresh_at: now,
    last_checkout_progress_at: now,
  });
}

export function transitionSamsclubAutoResumeToCheckout(
  channelId: string,
  pageUrl: string,
  autoCheckoutEnabled: boolean,
): void {
  const existing = readSamsclubAutoResume();
  const now = Date.now();
  if (!existing) {
    saveSamsclubAutoResume({
      channel_id: channelId,
      product_path: productPathFromUrl(pageUrl),
      phase: "checkout",
      auto_checkout_enabled: autoCheckoutEnabled,
      last_refresh_at: now,
      last_checkout_progress_at: now,
    });
    if (autoCheckoutEnabled) {
      markCheckoutNavigationStarted();
    }
    return;
  }

  saveSamsclubAutoResume({
    ...existing,
    channel_id: channelId,
    phase: "checkout",
    auto_checkout_enabled: autoCheckoutEnabled,
    last_checkout_progress_at: now,
  });
  if (autoCheckoutEnabled) {
    markCheckoutNavigationStarted();
  }
}

export function markSamsclubAutoRefreshed(): void {
  const resume = readSamsclubAutoResume();
  if (!resume) {
    return;
  }
  const now = Date.now();
  saveSamsclubAutoResume({
    ...resume,
    last_refresh_at: now,
    // Checkout stall refresh uses last_checkout_progress_at; reset it so reload
    // does not immediately qualify as stalled again.
    ...(resume.phase === "checkout" ? { last_checkout_progress_at: now } : {}),
  });
}

export function markCheckoutProgress(): void {
  const resume = readSamsclubAutoResume();
  if (!resume) {
    return;
  }
  saveSamsclubAutoResume({
    ...resume,
    last_checkout_progress_at: Date.now(),
  });
}

export function shouldResumeSamsclubAuto(pageUrl: string): SamsclubAutoResume | null {
  if (isSamsclubAutoUserStopped()) {
    return null;
  }
  const resume = readSamsclubAutoResume();
  if (!resume || resume.phase !== "pdp") {
    return null;
  }
  if (productPathFromUrl(pageUrl) !== resume.product_path) {
    return null;
  }
  return resume;
}

export function shouldResumeSamsclubCheckout(pageUrl: string): SamsclubAutoResume | null {
  if (isSamsclubAutoUserStopped()) {
    return null;
  }
  const resume = readSamsclubAutoResume();
  if (!resume || resume.phase !== "checkout") {
    return null;
  }

  if (isCheckoutAutomationUrl(pageUrl)) {
    return resume;
  }

  return null;
}
