import type { RetailerAutoConfig } from "@ext/domains/target/content/automation/checkout-auto.ts";
import { readRetailerAutoResume } from "@ext/domains/target/lib/auto-resume.ts";

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
  cachedStopOnOosEnabled: false,
  cachedCloseTabOnOosEnabled: false,
  stoppedDueToOos: false,
  oosCloseTabRequested: false,
  trackedPurchaseLimitHref: location.href,
  unhookRetailerNavigation: null as (() => void) | null,
  purchaseLimitWatchTeardown: null as (() => void) | null,
  unhookPurchaseLimitPageShow: null as (() => void) | null,
  checkoutAbandonHandled: false,
};

export const PURCHASE_LIMIT_SNAPSHOT_DELAYS_MS = [500, 2_000, 4_000, 8_000] as const;
export const PURCHASE_LIMIT_WATCH_DEBOUNCE_MS = 150;

export function applyCachedAutoConfig(config: RetailerAutoConfig): void {
  const previousCheckout = state.cachedAutoCheckoutEnabled;
  const resumeCheckout = readRetailerAutoResume()?.auto_checkout_enabled === true;

  state.cachedRefreshIntervalSec = config.refreshIntervalSec;
  state.cachedFrontendAtcEnabled = config.frontendAtcEnabled;
  state.cachedBackendAtcEnabled = config.backendAtcEnabled;
  state.cachedAtcQuantity = config.atcQuantity;
  state.cachedUseMaxQuantity = config.useMaxQuantity;
  state.cachedAutoCheckoutEnabled = config.autoCheckoutEnabled;
  state.cachedStopOnOosEnabled = config.stopOnOosEnabled;
  state.cachedCloseTabOnOosEnabled = config.closeTabOnOosEnabled;

  if (session.running) {
    state.cachedAutoCheckoutEnabled = previousCheckout;
  } else if (resumeCheckout) {
    state.cachedAutoCheckoutEnabled = true;
  }
}
