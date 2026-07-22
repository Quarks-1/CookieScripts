import { probeAddToCartViaApi, shouldRunCartApiProbe } from "@ext/domains/samsclub/lib/cart-api.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/domains/samsclub/lib/page-refresh.ts";
import { waitingForAddToCartStatus } from "@ext/domains/samsclub/lib/restock-wait.ts";
import { isThrottlePage } from "@ext/domains/samsclub/lib/throttle-page.ts";

function pathnameFromPageUrl(pageUrl: string): string {
  try {
    return new URL(pageUrl).pathname;
  } catch {
    return "";
  }
}

export type WaitingDisabledTickOptions = {
  pageUrl: string;
  tcin: string | null;
  backendAtcEnabled: boolean;
  onStatus?: (status: string) => void;
  shouldContinue: () => boolean;
  refreshIntervalSec: number;
  getRefreshIntervalSec?: () => number;
  requestHardReload?: () => Promise<void>;
  lastCartApiProbeMs: number | null;
  reportedWaiting: boolean;
  document?: Document;
  getEffectiveQuantity?: () => number;
};

export type WaitingDisabledTickResult = {
  lastCartApiProbeMs: number | null;
  reportedWaiting: boolean;
  outcome: "continue" | "reloading" | "aborted" | "cart_added" | "out_of_stock";
};

export async function runWaitingDisabledTick(
  options: WaitingDisabledTickOptions,
): Promise<WaitingDisabledTickResult> {
  let { lastCartApiProbeMs, reportedWaiting } = options;
  const doc = options.document ?? document;
  const bodyText = doc.body?.innerText ?? "";
  const pathname = pathnameFromPageUrl(options.pageUrl);

  if (isThrottlePage({ bodyText, pathname }) && options.requestHardReload) {
    options.onStatus?.("Throttle page — hard refreshing…");
    const refresh = await maybeHardRefreshWhileWaiting({
      refreshIntervalSec: options.getRefreshIntervalSec?.() ?? options.refreshIntervalSec,
      shouldContinue: options.shouldContinue,
      onStatus: options.onStatus,
      requestHardReload: options.requestHardReload,
    });
    if (refresh === "reloading") {
      return { lastCartApiProbeMs, reportedWaiting, outcome: "reloading" };
    }
    if (refresh === "aborted") {
      return { lastCartApiProbeMs, reportedWaiting, outcome: "aborted" };
    }
  }

  if (options.onStatus && !reportedWaiting) {
    options.onStatus(waitingForAddToCartStatus(doc, options.pageUrl));
    reportedWaiting = true;
  }

  if (options.backendAtcEnabled && options.tcin) {
    const nowMs = Date.now();
    if (shouldRunCartApiProbe(nowMs, lastCartApiProbeMs)) {
      lastCartApiProbeMs = nowMs;
      const probeResult = await probeAddToCartViaApi(
        options.tcin,
        { document: doc },
        options.getEffectiveQuantity?.() ?? 1,
      );
      if (probeResult.kind === "added") {
        return { lastCartApiProbeMs, reportedWaiting, outcome: "cart_added" };
      }
      if (probeResult.kind === "out_of_stock") {
        return { lastCartApiProbeMs, reportedWaiting, outcome: "out_of_stock" };
      }
    }
  }

  if (options.requestHardReload) {
    const refresh = await maybeHardRefreshWhileWaiting({
      refreshIntervalSec: options.getRefreshIntervalSec?.() ?? options.refreshIntervalSec,
      shouldContinue: options.shouldContinue,
      onStatus: options.onStatus,
      requestHardReload: options.requestHardReload,
    });
    if (refresh === "reloading") {
      return { lastCartApiProbeMs, reportedWaiting, outcome: "reloading" };
    }
    if (refresh === "aborted") {
      return { lastCartApiProbeMs, reportedWaiting, outcome: "aborted" };
    }
  }

  return { lastCartApiProbeMs, reportedWaiting, outcome: "continue" };
}
