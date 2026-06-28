import { buildElementDescriptor, type GeneratedDescriptor } from "@ext/lib/retailer/element-descriptor.ts";
import type { ElementDescriptor, RetailerProfile } from "@ext/types/retailer.ts";

export type RecordStepKind =
  | "add_to_cart"
  | "fulfillment_choice"
  | "cart_success_signal"
  | "navigate_checkout";

const FULFILLMENT_TEXT = /ship it|shipping/i;
const ADD_TO_CART_TEXT = /add to cart|pick it up|order pickup/i;

function inferStepKind(element: Element): RecordStepKind {
  const actionable =
    element.closest("button, a, [role='button']") ?? element;
  const text = actionable.textContent?.trim() ?? "";
  const aria = actionable.getAttribute("aria-label") ?? "";
  const combined = `${text} ${aria}`;
  if (FULFILLMENT_TEXT.test(combined)) {
    return "fulfillment_choice";
  }
  if (ADD_TO_CART_TEXT.test(combined)) {
    return "add_to_cart";
  }
  return "add_to_cart";
}

export function startRecording(
  onCaptured: (descriptor: ReturnType<typeof buildElementDescriptor>) => void,
): () => void {
  const handler = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const stepKind = inferStepKind(target);
    const descriptor = buildElementDescriptor({
      element: target,
      label: stepKind === "fulfillment_choice" ? "Ship it" : "Add to cart",
      stepKind,
      pageUrlPattern: "target.com/p/*",
    });

    onCaptured(descriptor);
  };

  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}

function descriptorToStep(descriptor: GeneratedDescriptor): import("@ext/types/retailer.ts").AutomationStep {
  switch (descriptor.stepKind) {
    case "fulfillment_choice":
      return {
        type: "click",
        selectors: descriptor.selectors,
        label: descriptor.label,
        optional: true,
      };
    case "add_to_cart":
      return {
        type: "keyboard_enter_hold",
        selectors: descriptor.selectors,
        holdMs: 400,
      };
    case "navigate_checkout":
      return {
        type: "navigate",
        url: "https://www.target.com/checkout/start",
      };
    case "cart_success_signal":
      return {
        type: "wait_for_cart_delta",
        minDelta: 1,
      };
  }
}

export function descriptorToProfile(descriptors: GeneratedDescriptor[]): RetailerProfile {
  return {
    profile_version: 1,
    host: "target.com",
    steps: descriptors.map(descriptorToStep),
    descriptors: descriptors.map((descriptor) => ({
      id: descriptor.id,
      label: descriptor.label,
      stepKind: descriptor.stepKind,
      selectors: descriptor.selectors,
      ariaLabel: descriptor.ariaLabel,
      dataTest: descriptor.dataTest,
      role: descriptor.role,
      tagName: descriptor.tagName,
      recordedAt: descriptor.recordedAt,
      pageUrlPattern: descriptor.pageUrlPattern,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export type { ElementDescriptor };
