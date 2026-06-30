import { BUTTON_POLL_MS } from "@ext/domains/walmart/lib/constants.ts";
import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

type TrackedButton = {
  selector: string;
  label: string;
  disabled: boolean;
};

function selectorForButton(el: HTMLElement): string | null {
  const automation = el.getAttribute("data-automation-id");
  if (automation) {
    return `[data-automation-id="${automation}"]`;
  }
  const testId = el.getAttribute("data-testid");
  if (testId) {
    return `[data-testid="${testId}"]`;
  }
  if (el.id) {
    return `#${typeof CSS !== "undefined" && "escape" in CSS ? CSS.escape(el.id) : el.id}`;
  }
  return null;
}

function collectTrackedButtons(root: ParentNode = document): TrackedButton[] {
  const tracked: TrackedButton[] = [];
  const nodes = root.querySelectorAll(
    "button, a[role='button'], [role='button'], input[type='submit']",
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    const selector = selectorForButton(node);
    if (!selector) {
      continue;
    }
    const label =
      node.getAttribute("aria-label")?.trim() ||
      (node.textContent ?? "").trim().slice(0, 80) ||
      selector;
    const disabled =
      node instanceof HTMLButtonElement
        ? node.disabled
        : node.getAttribute("aria-disabled") === "true";
    tracked.push({ selector, label, disabled });
    if (tracked.length >= 12) {
      break;
    }
  }
  return tracked;
}

export function attachButtonStatePolling(
  onEvent: (event: WalmartRecordingEvent) => void,
): () => void {
  const lastState = new Map<string, boolean>();

  const tick = () => {
    for (const button of collectTrackedButtons()) {
      const prev = lastState.get(button.selector);
      if (prev === undefined) {
        lastState.set(button.selector, button.disabled);
        continue;
      }
      if (prev !== button.disabled) {
        lastState.set(button.selector, button.disabled);
        onEvent({
          kind: "button_state",
          ts: new Date().toISOString(),
          url: location.href,
          selector: button.selector,
          label: button.label,
          disabled: button.disabled,
        });
      }
    }
  };

  const timer = setInterval(tick, BUTTON_POLL_MS);
  tick();
  return () => clearInterval(timer);
}
