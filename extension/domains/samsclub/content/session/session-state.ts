import type { SamsclubAutoConfig } from "@ext/domains/samsclub/content/automation/checkout-auto.ts";
import { readSamsclubAutoResume } from "@ext/domains/samsclub/lib/auto-resume.ts";

export type Session = {
  channelId: string | null;
  url: string | null;
  syncGeneration: number;
  running: boolean;
};

export const session: Session = {
  channelId: null,
  url: null,
  syncGeneration: 0,
  running: false,
};

export const state = {
  syncChain: Promise.resolve() as Promise<void>,
  sessionEnded: false,
  automationScheduled: false,
  autoConfigPrefetched: false,
  stopAutoRequested: false,
  cachedRefreshIntervalSec: 0,
  cachedFrontendAtcEnabled: true,
  cachedBackendAtcEnabled: false,
  cachedAtcQuantity: 1,
  cachedUseMaxQuantity: false,
  cachedAutoCheckoutEnabled: false,
  cachedCheckoutCvv: null as string | null,
  cachedStopOnOosEnabled: false,
  stoppedDueToOos: false,
  trackedPurchaseLimitHref: location.href,
  unhookSamsclubNavigation: null as (() => void) | null,
  purchaseLimitWatchTeardown: null as (() => void) | null,
  unhookPurchaseLimitPageShow: null as (() => void) | null,
  checkoutAbandonHandled: false,
};

export const PURCHASE_LIMIT_SNAPSHOT_DELAYS_MS = [500, 2_000, 4_000, 8_000] as const;
export const PURCHASE_LIMIT_WATCH_DEBOUNCE_MS = 150;

export function applyCachedAutoConfig(config: SamsclubAutoConfig): void {
  const previousCheckout = state.cachedAutoCheckoutEnabled;
  const resume = readSamsclubAutoResume();
  const resumeCheckout = resume?.auto_checkout_enabled === true;

  state.cachedRefreshIntervalSec = config.refreshIntervalSec;
  state.cachedFrontendAtcEnabled = config.frontendAtcEnabled;
  state.cachedBackendAtcEnabled = config.backendAtcEnabled;
  state.cachedAtcQuantity = config.atcQuantity;
  state.cachedUseMaxQuantity = config.useMaxQuantity;
  state.cachedAutoCheckoutEnabled = config.autoCheckoutEnabled;
  state.cachedCheckoutCvv = config.checkoutCvv;
  state.cachedStopOnOosEnabled = config.stopOnOosEnabled;

  if (resume?.phase === "checkout" && resumeCheckout) {
    state.cachedAutoCheckoutEnabled = true;
    return;
  }

  if (session.running) {
    state.cachedAutoCheckoutEnabled = previousCheckout;
  } else if (resumeCheckout) {
    state.cachedAutoCheckoutEnabled = true;
  }
}
