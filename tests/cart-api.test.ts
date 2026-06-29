/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildAddToCartBody,
  isTargetAuthDeniedBody,
  parseCartApiProbeResponse,
  probeAddToCartViaApi,
  shouldRunCartApiProbe,
  TARGET_CART_API_KEY,
  TARGET_CART_ITEMS_URL,
} from "@ext/lib/retailer/cart-api.ts";

describe("cart-api", () => {
  it("builds add-to-cart payload", () => {
    expect(buildAddToCartBody("1011209279")).toEqual({
      cart_item: { item_channel_id: "10", tcin: "1011209279", quantity: 1 },
      cart_type: "REGULAR",
      channel_id: "10",
      shopping_context: "DIGITAL",
    });
  });

  it("keeps cart API key in sync with injected script", () => {
    const probeSource = readFileSync(
      resolve(process.cwd(), "public/injected/cart-probe.js"),
      "utf8",
    );
    expect(probeSource).toContain(TARGET_CART_API_KEY);
  });

  it("parses added response from 201 only", () => {
    expect(parseCartApiProbeResponse(201, null)).toEqual({ kind: "added" });
    expect(parseCartApiProbeResponse(200, null)).toEqual({ kind: "error", status: 200 });
  });

  it("parses auth denied from status and body", () => {
    expect(parseCartApiProbeResponse(401, null)).toEqual({ kind: "unauthorized" });
    expect(
      parseCartApiProbeResponse(400, {
        errorKey: "_ERR_AUTH_DENIED",
        errorCode: "T83072242",
      }),
    ).toEqual({ kind: "unauthorized" });
    expect(
      isTargetAuthDeniedBody({
        errorKey: "_ERR_AUTH_DENIED",
      }),
    ).toBe(true);
  });

  it("parses inventory unavailable from 424", () => {
    expect(parseCartApiProbeResponse(424, null)).toEqual({ kind: "out_of_stock" });
  });

  it("parses inventory unavailable from alert body", () => {
    expect(
      parseCartApiProbeResponse(424, {
        code: "DEPENDENT_SERVICE_ERROR",
        alerts: [{ code: "INVENTORY_UNAVAILABLE" }],
      }),
    ).toEqual({ kind: "out_of_stock" });
  });

  it("parses Shape blocked response", () => {
    expect(parseCartApiProbeResponse(403, null)).toEqual({ kind: "blocked" });
  });

  it("throttles cart API probes", () => {
    expect(shouldRunCartApiProbe(1_000, null)).toBe(true);
    expect(shouldRunCartApiProbe(1_200, 1_000)).toBe(false);
    expect(shouldRunCartApiProbe(1_600, 1_000)).toBe(true);
  });

  it("uses page bridge when available", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (resourcePath: string) => `chrome-extension://test/${resourcePath}`,
      },
    });

    const probeInPageContext = vi.fn().mockResolvedValue({ status: 424, body: null });
    const ensureBridge = vi.fn().mockResolvedValue("ready" as const);
    const fetchFn = vi.fn();

    const result = await probeAddToCartViaApi("1011209279", {
      document,
      ensureBridge,
      probeInPageContext,
      fetchFn,
    });

    expect(result).toEqual({ kind: "out_of_stock" });
    expect(probeInPageContext).toHaveBeenCalledWith(
      TARGET_CART_ITEMS_URL,
      JSON.stringify(buildAddToCartBody("1011209279")),
      { doc: document },
    );
    expect(fetchFn).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("does not fall back when page bridge returns auth denied", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (resourcePath: string) => `chrome-extension://test/${resourcePath}`,
      },
    });

    const fetchFn = vi.fn();
    const result = await probeAddToCartViaApi("1011209279", {
      document,
      ensureBridge: vi.fn().mockResolvedValue("ready" as const),
      probeInPageContext: vi.fn().mockResolvedValue({
        status: 401,
        body: { errorKey: "_ERR_AUTH_DENIED" },
      }),
      fetchFn,
    });

    expect(result).toEqual({ kind: "unauthorized" });
    expect(fetchFn).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("falls back to extension-context fetch when page bridge fails", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (resourcePath: string) => `chrome-extension://test/${resourcePath}`,
      },
    });

    const fetchFn = vi.fn().mockResolvedValue({
      status: 201,
      headers: { get: () => "application/json" },
      json: async () => ({}),
    });

    const result = await probeAddToCartViaApi("13356914", {
      document,
      ensureBridge: vi.fn().mockResolvedValue("failed" as const),
      fetchFn,
    });

    expect(result).toEqual({ kind: "added" });
    expect(fetchFn).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("falls back to fetch when chrome runtime is unavailable", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 424,
      headers: { get: () => "application/json" },
      json: async () => ({}),
    });

    const result = await probeAddToCartViaApi("1011209279", { fetchFn });

    expect(result).toEqual({ kind: "out_of_stock" });
    expect(fetchFn).toHaveBeenCalled();
  });
});
