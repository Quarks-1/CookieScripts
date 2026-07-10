export interface MessageAnchor {
  href: string;
  text: string;
}

export interface SkuWatchProfile {
  retailer: "target" | "walmart";
  normalizeSku(raw: string): string | null;
  isAuxiliaryLink(href: string, anchorText: string): boolean;
}

export type SkuOpenDecision =
  | { action: "none" }
  | { action: "skip"; url: string }
  | { action: "open"; url: string; matchedSku: string };

export interface DecideSkuOpenActionInput {
  messageText: string;
  urls: string[];
  anchors?: MessageAnchor[];
  configuredSkus: string[];
}
