/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { buildElementDescriptor } from "@ext/lib/retailer/element-descriptor.ts";

describe("element-descriptor", () => {
  it("prefers data-test selectors", () => {
    const button = document.createElement("button");
    button.setAttribute("data-test", "shipItButton");
    button.textContent = "Ship it";

    const descriptor = buildElementDescriptor({
      element: button,
      label: "Ship it",
      stepKind: "fulfillment_choice",
      pageUrlPattern: "target.com/p/*",
    });

    expect(descriptor.selectors[0]).toBe('[data-test="shipItButton"]');
    expect(descriptor.brittle).toBe(false);
  });
});
