import { buildElementDescriptor } from "@ext/core/lib/recording/element-descriptor.ts";
import { describeClickLabel } from "@ext/domains/samsclub/content/recorder/click-label.ts";
import type { ElementDescriptor } from "@ext/domains/samsclub/types/samsclub.ts";

function findActionableElement(element: Element): Element {
  let current: Element | null = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    if (tag === "button" || tag === "a" || current.getAttribute("role") === "button") {
      return current;
    }
    current = current.parentElement;
  }
  return element;
}

export function buildSamsclubClickDescriptor(element: Element): ElementDescriptor {
  const actionable = findActionableElement(element);
  const descriptor = buildElementDescriptor({
    element,
    label: describeClickLabel(element),
    pageUrlPattern: "samsclub.com/*",
    attributePriority: ["data-automation-id", "data-testid", "data-test", "id", "aria-label"],
  });
  return {
    ...descriptor,
    dcaEvent: actionable.getAttribute("data-dca-event") ?? undefined,
    dcaAid: actionable.getAttribute("data-dca-aid") ?? undefined,
    dcaIntent: actionable.getAttribute("data-dca-intent") ?? undefined,
  };
}
