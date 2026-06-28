import { describe, expect, it } from "vitest";

import { defaultTargetAutomationSteps } from "@ext/lib/retailer/playback-engine.ts";
import { resolveAutomationSteps } from "@ext/lib/retailer/resolve-steps.ts";
import type { RetailerProfile } from "@ext/types/retailer.ts";

describe("resolveAutomationSteps", () => {
  it("returns defaults when no profile is saved", () => {
    expect(resolveAutomationSteps(null)).toEqual(defaultTargetAutomationSteps());
  });

  it("merges recorded add-to-cart selectors into the default pipeline", () => {
    const profile: RetailerProfile = {
      profile_version: 1,
      host: "target.com",
      steps: [
        {
          type: "click",
          selectors: ['[data-test="customAddToCart"]'],
          label: "Recorded element",
        },
      ],
      descriptors: [
        {
          id: "1",
          label: "Recorded element",
          stepKind: "add_to_cart",
          selectors: ['[data-test="customAddToCart"]', "#add-to-cart"],
          tagName: "button",
          recordedAt: "2026-01-01T00:00:00.000Z",
          pageUrlPattern: "target.com/p/*",
        },
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const steps = resolveAutomationSteps(profile);
    const keyboard = steps.find((step) => step.type === "keyboard_enter_hold");
    const navigate = steps.find((step) => step.type === "navigate");

    expect(keyboard?.type === "keyboard_enter_hold" && keyboard.selectors[0]).toBe(
      '[data-test="customAddToCart"]',
    );
    expect(navigate?.type).toBe("navigate");
    expect(steps.some((step) => step.type === "wait_for_cart_delta")).toBe(true);
  });

  it("infers add-to-cart from legacy click-only recordings", () => {
    const profile: RetailerProfile = {
      profile_version: 1,
      host: "target.com",
      steps: [
        {
          type: "click",
          selectors: ['[data-test="addToCartButton"]'],
          label: "Recorded element",
        },
      ],
      descriptors: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const keyboard = resolveAutomationSteps(profile).find(
      (step) => step.type === "keyboard_enter_hold",
    );
    expect(keyboard?.type === "keyboard_enter_hold" && keyboard.selectors[0]).toBe(
      '[data-test="addToCartButton"]',
    );
  });
});
