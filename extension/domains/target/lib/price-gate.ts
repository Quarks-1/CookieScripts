import { formatPriceGateMismatch } from "@ext/domains/target/lib/product-price.ts";

export type PriceGateResult =
  | { pass: true; liveCents: number; expectedCents: number }
  | { pass: false; reason: string; liveCents?: number; expectedCents?: number };

export const PRICE_GATE_SKU_NOT_IN_CATALOG = "Price gate: SKU not in catalog";
export const PRICE_GATE_CATALOG_UNAVAILABLE = "Price gate: catalog unavailable";
export const PRICE_GATE_PRICE_NOT_FOUND = "Price gate: price not found";
export const PRICE_GATE_TCIN_NOT_FOUND = "Price gate: TCIN not found";

export function evaluatePriceGate(
  liveCents: number | null,
  expectedCents: number | null,
): PriceGateResult {
  if (expectedCents == null) {
    return { pass: false, reason: PRICE_GATE_SKU_NOT_IN_CATALOG };
  }
  if (liveCents == null) {
    return { pass: false, reason: PRICE_GATE_PRICE_NOT_FOUND, expectedCents };
  }
  if (liveCents !== expectedCents) {
    return {
      pass: false,
      reason: formatPriceGateMismatch(liveCents, expectedCents),
      liveCents,
      expectedCents,
    };
  }
  return { pass: true, liveCents, expectedCents };
}
