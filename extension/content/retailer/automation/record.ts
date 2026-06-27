import { buildElementDescriptor, type GeneratedDescriptor } from "@ext/lib/retailer/element-descriptor.ts";
import type { ElementDescriptor, RetailerProfile } from "@ext/types/retailer.ts";

export type RecordStepKind =
  | "add_to_cart"
  | "fulfillment_choice"
  | "cart_success_signal"
  | "navigate_checkout";

export function startRecording(
  onCaptured: (descriptor: ReturnType<typeof buildElementDescriptor>) => void,
): () => void {
  const handler = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const descriptor = buildElementDescriptor({
      element: target,
      label: "Recorded element",
      stepKind: "add_to_cart",
      pageUrlPattern: "target.com/p/*",
    });

    onCaptured(descriptor);
  };

  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}

export function descriptorToProfile(descriptors: GeneratedDescriptor[]): RetailerProfile {
  return {
    profile_version: 1,
    host: "target.com",
    steps: descriptors.map((descriptor) => ({
      type: "click" as const,
      selectors: descriptor.selectors,
      label: descriptor.label,
    })),
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
