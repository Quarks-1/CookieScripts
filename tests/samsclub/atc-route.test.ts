import { describe, expect, it } from "vitest";

import {
  shouldSetPageQuantityBeforeAtc,
  shouldUseBackendAtc,
} from "@ext/domains/samsclub/lib/atc-route.ts";

describe("samsclub atc-route", () => {
  it("uses backend ATC when the buy box is missing on a PDP", () => {
    expect(shouldUseBackendAtc(true, true, 1, "not_found")).toBe(true);
  });

  it("uses backend ATC when the button is disabled", () => {
    expect(shouldUseBackendAtc(true, true, 1, "waiting_disabled")).toBe(true);
  });

  it("prefers frontend ATC when the button is ready", () => {
    expect(shouldUseBackendAtc(true, true, 1, "ready")).toBe(false);
  });

  it("only sets page quantity for frontend-only multi-qty adds", () => {
    expect(shouldSetPageQuantityBeforeAtc(true, false, 2)).toBe(true);
    expect(shouldSetPageQuantityBeforeAtc(true, true, 2)).toBe(false);
  });
});
