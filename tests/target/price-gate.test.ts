import { describe, expect, it } from "vitest";

import {
  evaluatePriceGate,
  PRICE_GATE_PRICE_NOT_FOUND,
  PRICE_GATE_SKU_NOT_IN_CATALOG,
} from "@ext/domains/target/lib/price-gate.ts";

describe("evaluatePriceGate", () => {
  it("passes on exact cent match", () => {
    expect(evaluatePriceGate(4999, 4999)).toEqual({
      pass: true,
      liveCents: 4999,
      expectedCents: 4999,
    });
  });

  it("fails when expected price is missing", () => {
    expect(evaluatePriceGate(4999, null)).toEqual({
      pass: false,
      reason: PRICE_GATE_SKU_NOT_IN_CATALOG,
    });
  });

  it("fails when live price is missing", () => {
    expect(evaluatePriceGate(null, 4999)).toEqual({
      pass: false,
      reason: PRICE_GATE_PRICE_NOT_FOUND,
      expectedCents: 4999,
    });
  });

  it("fails with formatted mismatch reason", () => {
    const result = evaluatePriceGate(5499, 4999);
    expect(result.pass).toBe(false);
    if (!result.pass) {
      expect(result.reason).toBe("Price gate: $54.99 ≠ $49.99");
    }
  });
});
