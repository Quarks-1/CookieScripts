import { isExtensionContextInvalidatedError, isExtensionContextValid } from "@ext/core/lib/messages.ts";
import { endSession } from "@ext/domains/samsclub/content/session/lifecycle.ts";
import { sendToBackground } from "@ext/domains/samsclub/content/session/messaging.ts";
import { readSamsclubAutoResume } from "@ext/domains/samsclub/lib/auto-resume.ts";
import {
  isCheckoutAutomationUrl,
  isCheckoutHandoffTransitUrl,
} from "@ext/domains/samsclub/lib/checkout/checkout-url.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/domains/samsclub/lib/page-refresh.ts";
import { isThrottlePage } from "@ext/domains/samsclub/lib/throttle-page.ts";

const TRANSIT_POLL_MS = 2_000;

let intervalId: number | null = null;
let getRefreshIntervalSec: (() => number) | null = null;

async function requestHardReload(): Promise<void> {
  if (!isExtensionContextValid()) {
    endSession();
    return;
  }
  try {
    await sendToBackground({ type: "SAMSCLUB_HARD_RELOAD" });
  } catch (err) {
    if (isExtensionContextInvalidatedError(err)) {
      endSession();
    }
  }
}

export function shouldRunTransitThrottleWatch(pageUrl: string): boolean {
  const resume = readSamsclubAutoResume();
  return resume?.phase === "checkout" && isCheckoutHandoffTransitUrl(pageUrl);
}

export function stopTransitThrottleWatch(): void {
  if (intervalId != null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

export function startTransitThrottleWatch(refreshIntervalSec: () => number): void {
  getRefreshIntervalSec = refreshIntervalSec;
  stopTransitThrottleWatch();

  if (!shouldRunTransitThrottleWatch(location.href)) {
    return;
  }

  const tick = async (): Promise<void> => {
    if (!shouldRunTransitThrottleWatch(location.href) || isCheckoutAutomationUrl(location.href)) {
      stopTransitThrottleWatch();
      return;
    }

    const bodyText = document.body?.innerText ?? "";
    if (!isThrottlePage({ bodyText, pathname: location.pathname })) {
      return;
    }

    const refresh = await maybeHardRefreshWhileWaiting({
      refreshIntervalSec: getRefreshIntervalSec?.() ?? 0,
      shouldContinue: () => shouldRunTransitThrottleWatch(location.href),
      requestHardReload,
      stallTimestampField: "last_checkout_progress_at",
    });
    if (refresh === "reloading" || refresh === "aborted") {
      stopTransitThrottleWatch();
    }
  };

  void tick();
  intervalId = window.setInterval(() => {
    void tick();
  }, TRANSIT_POLL_MS);
}

export function syncTransitThrottleWatch(refreshIntervalSec: () => number): void {
  if (shouldRunTransitThrottleWatch(location.href)) {
    startTransitThrottleWatch(refreshIntervalSec);
    return;
  }
  stopTransitThrottleWatch();
}
