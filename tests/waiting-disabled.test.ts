/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import { probeAddToCartViaApi } from "@ext/lib/retailer/cart-api.ts";
import { runWaitingDisabledTick } from "@ext/lib/retailer/waiting-disabled.ts";

vi.mock("@ext/lib/retailer/cart-api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ext/lib/retailer/cart-api.ts")>();
  return {
    ...actual,
    probeAddToCartViaApi: vi.fn(),
  };
});

describe("waiting-disabled", () => {
  beforeEach(() => {
    vi.mocked(probeAddToCartViaApi).mockReset();
  });

  it("skips API probe when backend ATC is disabled", async () => {
    const result = await runWaitingDisabledTick({
      pageUrl: "https://www.target.com/p/-/A-1011209279",
      tcin: "1011209279",
      backendAtcEnabled: false,
      shouldContinue: () => true,
      refreshIntervalSec: 0,
      lastCartApiProbeMs: null,
      reportedWaiting: false,
    });

    expect(probeAddToCartViaApi).not.toHaveBeenCalled();
    expect(result.outcome).toBe("continue");
  });

  it("runs API probe when backend ATC is enabled", async () => {
    vi.mocked(probeAddToCartViaApi).mockResolvedValue({ kind: "out_of_stock" });

    const result = await runWaitingDisabledTick({
      pageUrl: "https://www.target.com/p/-/A-1011209279",
      tcin: "1011209279",
      backendAtcEnabled: true,
      shouldContinue: () => true,
      refreshIntervalSec: 0,
      lastCartApiProbeMs: null,
      reportedWaiting: false,
    });

    expect(probeAddToCartViaApi).toHaveBeenCalledWith("1011209279");
    expect(result.outcome).toBe("continue");
  });

  it("returns cart_added when probe succeeds", async () => {
    vi.mocked(probeAddToCartViaApi).mockResolvedValue({ kind: "added" });

    const result = await runWaitingDisabledTick({
      pageUrl: "https://www.target.com/p/-/A-1011209279",
      tcin: "1011209279",
      backendAtcEnabled: true,
      shouldContinue: () => true,
      refreshIntervalSec: 0,
      lastCartApiProbeMs: null,
      reportedWaiting: false,
    });

    expect(result.outcome).toBe("cart_added");
  });
});
