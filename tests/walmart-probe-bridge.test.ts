// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WALMART_PROBE_EVENT } from "@ext/lib/walmart/constants.ts";
import {
  listenWalmartProbe,
  removeWalmartResearchProbe,
} from "@ext/lib/walmart/page-probe-bridge.ts";

describe("walmart page-probe-bridge", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "";
    vi.stubGlobal("chrome", {
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    });
  });

  afterEach(() => {
    removeWalmartResearchProbe(document);
    vi.unstubAllGlobals();
  });

  it("forwards probe events to the listener", () => {
    const received: unknown[] = [];
    const stop = listenWalmartProbe(document, (detail) => {
      received.push(detail);
    });

    document.dispatchEvent(
      new CustomEvent(WALMART_PROBE_EVENT, {
        detail: { kind: "fetch", method: "GET", url: "https://example.com" },
      }),
    );

    stop();
    expect(received).toHaveLength(1);
  });
});
