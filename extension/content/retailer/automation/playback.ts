import {
  cartCountIncreased,
  hasCartSuccessLiveRegion,
  readCartCountFromDocument,
} from "@ext/lib/retailer/cart-step.ts";
import {
  defaultTargetAutomationSteps,
  runPlaybackEngine,
} from "@ext/lib/retailer/playback-engine.ts";
import { DEFAULT_ADD_TO_CART_SELECTORS } from "@ext/content/retailer/selectors.ts";
import type { AutomationStep } from "@ext/types/retailer.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findClickable(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  return null;
}

async function focusWalkToElement(target: HTMLElement): Promise<boolean> {
  target.focus();
  if (document.activeElement === target) {
    return true;
  }

  const focusable = [...document.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )];

  for (let i = 0; i < Math.min(focusable.length, 40); i++) {
    const current = document.activeElement;
    if (current === target) {
      return true;
    }
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    await sleep(40);
  }

  return document.activeElement === target;
}

async function keyboardEnterHold(element: HTMLElement, holdMs: number): Promise<boolean> {
  const focused = await focusWalkToElement(element);
  if (!focused) {
    element.click();
    return true;
  }

  const down = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
    repeat: true,
  });
  element.dispatchEvent(down);
  await sleep(holdMs);
  element.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
  );
  return true;
}

async function waitForCartDelta(minDelta: number, timeoutMs: number): Promise<boolean> {
  const before = readCartCountFromDocument(document);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const after = readCartCountFromDocument(document);
    if (cartCountIncreased(before, after, minDelta) || hasCartSuccessLiveRegion(document)) {
      return true;
    }
    await sleep(300);
  }

  return false;
}

export async function runAutomationPlayback(
  steps: AutomationStep[],
  onStatus: (status: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return runPlaybackEngine(steps, {
    click: async (selectors) => {
      onStatus("Clicking…");
      const element = findClickable(selectors);
      if (!element) {
        return false;
      }
      element.click();
      await sleep(400);
      return true;
    },
    keyboardEnterHold: async (selectors, holdMs) => {
      onStatus("Adding to cart…");
      const element = findClickable(selectors.length ? selectors : DEFAULT_ADD_TO_CART_SELECTORS);
      if (!element) {
        return false;
      }
      await keyboardEnterHold(element, holdMs);
      await sleep(400);
      return true;
    },
    waitForCartDelta: async (minDelta, timeoutMs) => {
      onStatus("Waiting for cart…");
      return waitForCartDelta(minDelta, timeoutMs);
    },
    navigate: (url) => {
      onStatus("Going to checkout…");
      location.assign(url);
    },
  });
}

export function resolveAutomationSteps(
  profileSteps: AutomationStep[] | undefined,
): AutomationStep[] {
  if (profileSteps && profileSteps.length > 0) {
    return profileSteps;
  }
  return defaultTargetAutomationSteps();
}
