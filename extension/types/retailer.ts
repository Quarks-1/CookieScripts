export type AutomationStep =
  | { type: "click"; selectors: string[]; label: string; optional?: boolean }
  | { type: "keyboard_enter_hold"; selectors: string[]; holdMs: number }
  | { type: "wait_for_cart_delta"; minDelta: number }
  | { type: "navigate"; url: string };

export interface ElementDescriptor {
  id: string;
  label: string;
  stepKind: "add_to_cart" | "fulfillment_choice" | "cart_success_signal" | "navigate_checkout";
  selectors: string[];
  ariaLabel?: string;
  dataTest?: string;
  role?: string;
  tagName: string;
  recordedAt: string;
  pageUrlPattern: string;
}

export interface RetailerProfile {
  profile_version: 1;
  host: "target.com";
  steps: AutomationStep[];
  descriptors: ElementDescriptor[];
  updatedAt: string;
}

export type RetailerProfilesStore = {
  target: RetailerProfile | null;
};

export type RetailerAutoSource = "discord" | "manual";

export type RetailerAutoStatus =
  | "idle"
  | "finding_button"
  | "adding"
  | "waiting_cart"
  | "navigating"
  | "success"
  | "failed";
