import { isExtensionContextInvalidatedError, isExtensionContextValid } from "@ext/core/lib/messages.ts";
import { isSamsclubProductUrl } from "@ext/domains/samsclub/lib/host.ts";
import { clearPageQuantityApplied, readPurchaseLimitForStatus } from "@ext/domains/samsclub/lib/quantity-limit.ts";
import { endSession } from "@ext/domains/samsclub/content/session/lifecycle.ts";
import { sendToBackground } from "@ext/domains/samsclub/content/session/messaging.ts";
import { maybeFailCheckoutAbandon } from "@ext/domains/samsclub/content/session/checkout-abandon.ts";
import { clearCheckoutNavigationGrace } from "@ext/domains/samsclub/lib/auto-resume.ts";
import { tryResumeAutomation } from "@ext/domains/samsclub/content/session/resume.ts";
import { shouldResumeSamsclubCheckout } from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  PURCHASE_LIMIT_SNAPSHOT_DELAYS_MS,
  PURCHASE_LIMIT_WATCH_DEBOUNCE_MS,
  state,
} from "@ext/domains/samsclub/content/session/session-state.ts";

function publishPurchaseLimitSnapshot(allowNull = false): void {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  if (!isSamsclubProductUrl(location.href)) {
    return;
  }

  const purchaseLimit = readPurchaseLimitForStatus(document);
  if (purchaseLimit == null && !allowNull) {
    return;
  }

  void sendToBackground({
    type: "SAMSCLUB_PURCHASE_LIMIT_SNAPSHOT",
    purchase_limit: purchaseLimit,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

function resetPurchaseLimitSnapshot(): void {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  void sendToBackground({
    type: "SAMSCLUB_PURCHASE_LIMIT_SNAPSHOT",
    purchase_limit: null,
  }).catch((err) => {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  });
}

export function schedulePurchaseLimitSnapshots(): void {
  publishPurchaseLimitSnapshot();
  for (const delayMs of PURCHASE_LIMIT_SNAPSHOT_DELAYS_MS) {
    globalThis.setTimeout(() => publishPurchaseLimitSnapshot(), delayMs);
  }
  globalThis.setTimeout(() => publishPurchaseLimitSnapshot(true), 12_000);
}

export function teardownPurchaseLimitWatch(): void {
  state.purchaseLimitWatchTeardown?.();
  state.purchaseLimitWatchTeardown = null;
}

export function armPurchaseLimitWatch(): void {
  teardownPurchaseLimitWatch();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSnapshot = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = globalThis.setTimeout(() => {
      debounceTimer = null;
      publishPurchaseLimitSnapshot();
    }, PURCHASE_LIMIT_WATCH_DEBOUNCE_MS);
  };

  const observers: MutationObserver[] = [];
  const observe = (target: Node, options: MutationObserverInit) => {
    const observer = new MutationObserver(() => scheduleSnapshot());
    observer.observe(target, options);
    observers.push(observer);
  };

  const nextData = document.getElementById("__NEXT_DATA__");
  if (nextData) {
    observe(nextData, { childList: true, characterData: true, subtree: true });
  } else if (document.head) {
    observe(document.head, { childList: true, subtree: false });
  }

  state.purchaseLimitWatchTeardown = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    for (const observer of observers) {
      observer.disconnect();
    }
    state.purchaseLimitWatchTeardown = null;
  };
}

export function refreshPurchaseLimitForPage(force = false): void {
  if (state.sessionEnded || !isExtensionContextValid()) {
    endSession();
    return;
  }

  const href = location.href;
  if (!force && href === state.trackedPurchaseLimitHref) {
    return;
  }
  state.trackedPurchaseLimitHref = href;

  clearPageQuantityApplied();
  teardownPurchaseLimitWatch();
  resetPurchaseLimitSnapshot();

  if (isSamsclubProductUrl(href)) {
    schedulePurchaseLimitSnapshots();
    armPurchaseLimitWatch();
  }
}

export function handleSamsclubNavigation(): void {
  refreshPurchaseLimitForPage(false);
  maybeFailCheckoutAbandon();
  if (shouldResumeSamsclubCheckout(location.href)) {
    clearCheckoutNavigationGrace();
    tryResumeAutomation();
  }
}

export function hookPurchaseLimitPageShow(): void {
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !isSamsclubProductUrl(location.href)) {
      return;
    }
    refreshPurchaseLimitForPage(true);
  };
  window.addEventListener("pageshow", onPageShow);
  state.unhookPurchaseLimitPageShow = () => {
    window.removeEventListener("pageshow", onPageShow);
    state.unhookPurchaseLimitPageShow = null;
  };
}

export function teardownPurchaseLimitPageShow(): void {
  state.unhookPurchaseLimitPageShow?.();
  state.unhookPurchaseLimitPageShow = null;
}
