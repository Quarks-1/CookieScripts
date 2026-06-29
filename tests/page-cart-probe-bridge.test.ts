/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CART_PROBE_REQUEST_EVENT,
  CART_PROBE_RESPONSE_EVENT,
  ensurePageCartProbeBridge,
  probeInPageContext,
} from "@ext/lib/retailer/page-cart-probe-bridge.ts";

describe("page-cart-probe-bridge", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips probe requests via document events", async () => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      document.dispatchEvent(
        new CustomEvent(CART_PROBE_RESPONSE_EVENT, {
          detail: {
            probeId: detail.probeId,
            status: 424,
            body: { code: "DEPENDENT_SERVICE_ERROR" },
          },
        }),
      );
    };
    document.addEventListener(CART_PROBE_REQUEST_EVENT, handler);

    const result = await probeInPageContext("https://carts.target.com/test", '{"tcin":"1"}');

    document.removeEventListener(CART_PROBE_REQUEST_EVENT, handler);

    expect(result).toEqual({
      status: 424,
      body: { code: "DEPENDENT_SERVICE_ERROR" },
    });
  });

  it("rejects when probe response times out", async () => {
    vi.useFakeTimers();

    const pending = probeInPageContext("https://carts.target.com/test", "{}", {
      timeoutMs: 100,
    });
    const rejection = expect(pending).rejects.toThrow("cart probe timeout");

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });

  it("skips re-injection when bridge script is already ready", async () => {
    const script = document.createElement("script");
    script.id = "cookiescripts-cart-probe-bridge";
    script.setAttribute("data-cs-bridge", "ready");
    document.documentElement.appendChild(script);

    const getScriptUrl = vi.fn(() => "https://example.test/injected/cart-probe.js");
    const result = await ensurePageCartProbeBridge(document, getScriptUrl);

    expect(result).toBe("ready");
    expect(getScriptUrl).not.toHaveBeenCalled();
  });

  it("waits for an in-flight bridge injection", async () => {
    const script = document.createElement("script");
    script.id = "cookiescripts-cart-probe-bridge";
    script.setAttribute("data-cs-bridge", "loading");
    document.documentElement.appendChild(script);

    const getScriptUrl = vi.fn(() => "https://example.test/injected/cart-probe.js");
    const pending = ensurePageCartProbeBridge(document, getScriptUrl);

    script.setAttribute("data-cs-bridge", "ready");
    const result = await pending;

    expect(result).toBe("ready");
    expect(getScriptUrl).not.toHaveBeenCalled();
  });

  it("resolves failed when bridge script never signals ready", async () => {
    vi.useFakeTimers();

    const getScriptUrl = vi.fn(() => "https://example.test/injected/cart-probe.js");
    let injectedScript: HTMLScriptElement | null = null;
    const appendChild = vi
      .spyOn(document.documentElement, "appendChild")
      .mockImplementation((node) => {
        if (node instanceof HTMLScriptElement) {
          injectedScript = node;
          return node;
        }
        return node;
      });

    const pending = ensurePageCartProbeBridge(document, getScriptUrl);
    expect(injectedScript).toBeInstanceOf(HTMLScriptElement);
    injectedScript!.onload?.(new Event("load"));

    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toBe("failed");

    appendChild.mockRestore();
  });
});
