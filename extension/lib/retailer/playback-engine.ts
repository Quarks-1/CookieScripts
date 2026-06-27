import type { AutomationStep } from "@ext/types/retailer.ts";

export const CHECKOUT_START_URL = "https://www.target.com/checkout/start";

export function defaultTargetAutomationSteps(): AutomationStep[] {
  return [
    {
      type: "click",
      selectors: ['button[data-test="shipItButton"]'],
      label: "Ship it",
    },
    {
      type: "keyboard_enter_hold",
      selectors: [
        'button[data-test="addToCartButton"]',
        'button[data-test="orderPickupButton"]',
      ],
      holdMs: 400,
    },
    {
      type: "wait_for_cart_delta",
      minDelta: 1,
      timeoutMs: 15_000,
    },
    {
      type: "navigate",
      url: CHECKOUT_START_URL,
    },
  ];
}

export type PlaybackEngineCallbacks = {
  click: (selectors: string[]) => Promise<boolean>;
  keyboardEnterHold: (selectors: string[], holdMs: number) => Promise<boolean>;
  waitForCartDelta: (minDelta: number, timeoutMs: number) => Promise<boolean>;
  navigate: (url: string) => void;
};

export async function runPlaybackEngine(
  steps: AutomationStep[],
  callbacks: PlaybackEngineCallbacks,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const step of steps) {
    switch (step.type) {
      case "click": {
        const clicked = await callbacks.click(step.selectors);
        if (!clicked) {
          return { ok: false, error: `Click failed: ${step.label}` };
        }
        break;
      }
      case "keyboard_enter_hold": {
        const pressed = await callbacks.keyboardEnterHold(step.selectors, step.holdMs);
        if (!pressed) {
          return { ok: false, error: "Add to cart keyboard action failed" };
        }
        break;
      }
      case "wait_for_cart_delta": {
        const confirmed = await callbacks.waitForCartDelta(step.minDelta, step.timeoutMs);
        if (!confirmed) {
          return { ok: false, error: "Cart did not update in time" };
        }
        break;
      }
      case "navigate": {
        callbacks.navigate(step.url);
        break;
      }
    }
  }
  return { ok: true };
}
