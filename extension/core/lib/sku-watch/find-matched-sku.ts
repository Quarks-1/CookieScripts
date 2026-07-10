import { messageContainsExactSku } from "@ext/core/lib/sku-watch/match.ts";

export function findMatchedSku(corpus: string, configuredSkus: string[]): string | null {
  for (const sku of configuredSkus) {
    if (messageContainsExactSku(corpus, sku)) {
      return sku;
    }
  }
  return null;
}
