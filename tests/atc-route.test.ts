import { describe, expect, it } from "vitest";

import {
  shouldSetPageQuantityBeforeAtc,
  shouldUseBackendAtc,
} from "@ext/lib/retailer/atc-route.ts";
import { defaultTargetAutomationSteps } from "@ext/lib/retailer/playback-engine.ts";

describe("atc-route", () => {
  it("uses backend ATC when quantity is greater than 1 and frontend is unavailable", () => {
    expect(shouldUseBackendAtc(true, true, 2, "ready")).toBe(false);
    expect(shouldUseBackendAtc(true, false, 2, "ready")).toBe(true);
    expect(shouldUseBackendAtc(true, true, 2, "waiting_disabled")).toBe(true);
    expect(shouldUseBackendAtc(true, true, 1, "ready")).toBe(false);
  });

  it("uses backend ATC when frontend is off or button is disabled", () => {
    expect(shouldUseBackendAtc(true, false, 1, "ready")).toBe(true);
    expect(shouldUseBackendAtc(true, true, 1, "waiting_disabled")).toBe(true);
  });

  it("only sets page quantity for frontend-only multi-qty adds", () => {
    expect(shouldSetPageQuantityBeforeAtc(true, false, 2)).toBe(true);
    expect(shouldSetPageQuantityBeforeAtc(true, true, 2)).toBe(false);
    expect(shouldSetPageQuantityBeforeAtc(true, false, 1)).toBe(false);
  });
});

describe("defaultTargetAutomationSteps", () => {
  it("always waits for a single cart line item, not unit quantity", () => {
    const steps = defaultTargetAutomationSteps(5);
    const waitStep = steps.find((step) => step.type === "wait_for_cart_delta");
    expect(waitStep).toEqual({ type: "wait_for_cart_delta", minDelta: 1 });
  });
});
