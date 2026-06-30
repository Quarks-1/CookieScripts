// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { buildElementDescriptor } from "@ext/lib/recording/element-descriptor.ts";

describe("element-descriptor", () => {
  it("prioritizes data-automation-id for walmart-like buttons", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.setAttribute("data-automation-id", "add-to-cart");
    button.id = "legacy";
    root.appendChild(button);

    const descriptor = buildElementDescriptor({
      element: button,
      label: "ATC",
      pageUrlPattern: "walmart.com/*",
      attributePriority: ["data-automation-id", "id"],
    });

    expect(descriptor.selectors[0]).toBe('[data-automation-id="add-to-cart"]');
    expect(descriptor.dataAutomationId).toBe("add-to-cart");
  });
});
