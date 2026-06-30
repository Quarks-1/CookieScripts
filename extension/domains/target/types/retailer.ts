export type AutomationStep =
  | { type: "click"; selectors: string[]; label: string; optional?: boolean }
  | { type: "keyboard_enter_hold"; selectors: string[]; holdMs: number }
  | { type: "wait_for_cart_delta"; minDelta: number }
  | { type: "navigate"; url: string };
