export type AutomationStep =
  | { type: "click"; selectors: string[]; label: string; optional?: boolean }
  | { type: "keyboard_enter_hold"; selectors: string[]; holdMs: number }
  | { type: "wait_for_cart_delta"; minDelta: number }
  | { type: "navigate"; url: string };

export type RetailerPageKind =
  | "home"
  | "product"
  | "cart"
  | "checkout"
  | "order_confirmation"
  | "other";

export interface RetailerOpenTabSummary {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  label: string;
  pageKind: RetailerPageKind;
  isActive: boolean;
  isRunning: boolean;
}
