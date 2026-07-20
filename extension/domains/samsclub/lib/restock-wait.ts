import {
  parseSamsclubItemIdFromUrl,
} from "@ext/domains/samsclub/lib/main-add-to-cart.ts";

const MAIN_ATC_SELECTOR = 'button[data-automation-id="atc"]';

export function isRestockWaitPage(doc: Document, pageUrl: string): boolean {
  const itemId = parseSamsclubItemIdFromUrl(pageUrl);
  if (!itemId || !pageUrl.includes("/ip/")) {
    return false;
  }

  const bodyText = (doc.body?.innerText ?? "").toLowerCase();
  const bodyRaw = doc.body?.innerText ?? "";
  if (
    bodyText.includes("out of stock") ||
    bodyText.includes("sold out") ||
    bodyText.includes("currently unavailable")
  ) {
    return true;
  }

  const atcButtons = doc.querySelectorAll(MAIN_ATC_SELECTOR);
  for (const node of atcButtons) {
    if (!(node instanceof HTMLButtonElement)) {
      continue;
    }
    const aria = node.getAttribute("aria-label") ?? "";
    const text = node.textContent?.trim() ?? "";
    const isMainAtc =
      /add to cart/i.test(aria) || text === "Add to Cart" || aria.includes(itemId);
    if (!isMainAtc) {
      continue;
    }
    if (node.disabled || node.getAttribute("aria-disabled") === "true") {
      return true;
    }
    return false;
  }

  if (
    bodyText.includes("shop similar") ||
    bodyText.includes("not available") ||
    /\bdrops?\s+\w+/i.test(bodyRaw)
  ) {
    return true;
  }

  return false;
}

export function waitingForAddToCartStatus(doc: Document, pageUrl: string): string {
  return isRestockWaitPage(doc, pageUrl)
    ? "Waiting for restock…"
    : "Waiting for main Add to cart…";
}
