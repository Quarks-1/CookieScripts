import { probeAddToCartViaApi, shouldRunCartApiProbe } from "@ext/domains/target/lib/cart-api.ts";
import { maybeHardRefreshWhileWaiting } from "@ext/domains/target/lib/page-refresh.ts";
import { waitingForAddToCartStatus } from "@ext/domains/target/lib/restock-wait.ts";

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
