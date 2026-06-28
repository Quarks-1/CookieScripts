import { defaultTargetAutomationSteps } from "@ext/lib/retailer/playback-engine.ts";
import type { AutomationStep, ElementDescriptor, RetailerProfile } from "@ext/types/retailer.ts";

function cloneSteps(steps: AutomationStep[]): AutomationStep[] {
  return steps.map((step) => ({ ...step }));
}

function replaceClickSelectors(
  steps: AutomationStep[],
  label: string,
  selectors: string[],
): void {
  const click = steps.find((step) => step.type === "click" && step.label === label);
  if (click?.type === "click") {
    click.selectors = [...selectors, ...click.selectors];
  }
}

function replaceKeyboardSelectors(steps: AutomationStep[], selectors: string[]): void {
  const keyboard = steps.find((step) => step.type === "keyboard_enter_hold");
  if (keyboard?.type === "keyboard_enter_hold") {
    keyboard.selectors = [...selectors, ...keyboard.selectors];
  }
}

function inferDescriptorsFromProfile(profile: RetailerProfile): ElementDescriptor[] {
  if (profile.descriptors.length > 0) {
    return profile.descriptors;
  }

  const keyboard = profile.steps.find((step) => step.type === "keyboard_enter_hold");
  if (keyboard?.type === "keyboard_enter_hold") {
    return [
      {
        id: "legacy-keyboard",
        label: "Recorded add to cart",
        stepKind: "add_to_cart",
        selectors: keyboard.selectors,
        tagName: "button",
        recordedAt: profile.updatedAt,
        pageUrlPattern: "target.com/p/*",
      },
    ];
  }

  const clicks = profile.steps.filter((step) => step.type === "click");
  if (clicks.length === 1 && clicks[0]?.type === "click") {
    return [
      {
        id: "legacy",
        label: clicks[0].label,
        stepKind: "add_to_cart",
        selectors: clicks[0].selectors,
        tagName: "button",
        recordedAt: profile.updatedAt,
        pageUrlPattern: "target.com/p/*",
      },
    ];
  }

  return [];
}

export function applyRecordedSelectors(
  steps: AutomationStep[],
  descriptors: ElementDescriptor[],
): AutomationStep[] {
  const merged = cloneSteps(steps);

  for (const descriptor of descriptors) {
    const selectors = descriptor.selectors.filter(Boolean);
    if (!selectors.length) {
      continue;
    }

    switch (descriptor.stepKind) {
      case "fulfillment_choice":
        replaceClickSelectors(merged, "Ship it", selectors);
        break;
      case "add_to_cart":
        replaceKeyboardSelectors(merged, selectors);
        break;
      case "cart_success_signal":
      case "navigate_checkout":
        break;
    }
  }

  return merged;
}

export function resolveAutomationSteps(profile?: RetailerProfile | null): AutomationStep[] {
  const defaults = defaultTargetAutomationSteps();
  if (!profile) {
    return defaults;
  }

  const descriptors = inferDescriptorsFromProfile(profile);
  if (!descriptors.length && !profile.steps.length) {
    return defaults;
  }

  return applyRecordedSelectors(defaults, descriptors);
}
