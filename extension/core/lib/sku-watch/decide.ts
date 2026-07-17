import type { WatchSkuRetailer } from "@ext/core/lib/channel-targets.ts";
import { buildSkuSearchCorpus } from "@ext/core/lib/sku-watch/corpus.ts";
import { findMatchedSku } from "@ext/core/lib/sku-watch/find-matched-sku.ts";
import type { DecideSkuOpenActionInput, SkuOpenDecision } from "@ext/core/lib/sku-watch/types.ts";
import { buildTargetProductUrlFromSku } from "@ext/domains/target/lib/index.ts";
import { buildWalmartProductUrlFromSku } from "@ext/domains/walmart/lib/index.ts";

const BUILDERS: Record<WatchSkuRetailer, (sku: string) => string> = {
  target: buildTargetProductUrlFromSku,
  walmart: buildWalmartProductUrlFromSku,
};

export function decideSkuOpenAction(
  retailer: WatchSkuRetailer,
  input: DecideSkuOpenActionInput,
): SkuOpenDecision {
  const { messageText, urls, configuredSkus } = input;

  if (configuredSkus.length === 0) {
    return { action: "none" };
  }

  const corpus = buildSkuSearchCorpus(messageText, urls);
  const matchedSku = findMatchedSku(corpus, configuredSkus);
  if (matchedSku === null) {
    return { action: "skip", url: urls[0] ?? "" };
  }

  return {
    action: "open",
    url: BUILDERS[retailer](matchedSku),
    matchedSku,
  };
}
