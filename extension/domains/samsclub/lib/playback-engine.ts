import type { AutomationStep } from "@ext/core/types/index.ts";
import {
  buildCheckoutReviewOrderUrl,
  readSamsclubCartId,
} from "@ext/domains/samsclub/lib/cart-id.ts";
import {
  CHECKOUT_START_URL,
  DEFAULT_ADD_TO_CART_SELECTORS,
  SAMSCLUB_CART_URL,
  SHIP_IT_SELECTORS,
} from "@ext/domains/samsclub/lib/selectors.ts";

export { CHECKOUT_START_URL };

export function resolveCheckoutStartUrl(doc: Document = document): string {
  const cartId = readSamsclubCartId(doc.defaultView?.localStorage ?? null);
  if (cartId) {
    return buildCheckoutReviewOrderUrl(cartId);
  }
  return SAMSCLUB_CART_URL;
}

export function defaultSamsclubAutomationSteps(_effectiveQuantity = 1): AutomationStep[] {
  return [
    {
      type: "click",
      selectors: [...SHIP_IT_SELECTORS],
      label: "Ship it",
      optional: true,
    },
    {
      type: "keyboard_enter_hold",
      selectors: [...DEFAULT_ADD_TO_CART_SELECTORS],
      holdMs: 400,
    },
    {
      type: "wait_for_cart_delta",
      minDelta: 1,
    },
    {
      type: "navigate",
      url: CHECKOUT_START_URL,
    },
  ];
}

export type PlaybackEngineCallbacks = {
  click: (selectors: string[], optional?: boolean) => Promise<boolean>;
  keyboardEnterHold: (selectors: string[], holdMs: number) => Promise<boolean>;
  waitForCartDelta: (minDelta: number) => Promise<boolean>;
  navigate: (url: string) => void;
};

export async function runPlaybackEngine(
  steps: AutomationStep[],
  callbacks: PlaybackEngineCallbacks,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const step of steps) {
    switch (step.type) {
      case "click": {
        const clicked = await callbacks.click(step.selectors, step.optional === true);
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
        const confirmed = await callbacks.waitForCartDelta(step.minDelta);
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
