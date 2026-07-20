import type { SamsclubPageKind } from "@ext/domains/samsclub/types/samsclub.ts";

function isPostCheckoutPath(path: string): boolean {
  return (
    path.includes("/thankyou") ||
    path.includes("/thank-you") ||
    path.includes("/order-confirmation") ||
    path.includes("/purchase-confirmation") ||
    path.includes("/orders/") ||
    path.includes("/orderplaced")
  );
}

function isHomePath(path: string): boolean {
  return path === "/" || path === "";
}

export function classifySamsclubPageKind(url: string): SamsclubPageKind {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes("/blocked") || path.includes("/are-you-human")) {
      return "blocked";
    }
    if (path === "/search" || path.startsWith("/search/")) {
      return "search";
    }
    if (/\/ip\/[^/]+\/\d+/.test(path)) {
      return "product";
    }
    if (path === "/cart" || path.startsWith("/cart")) {
      return "cart";
    }
    if (isPostCheckoutPath(path)) {
      return "post_checkout";
    }
    if (path.includes("/checkout")) {
      return "checkout";
    }
    if (isHomePath(path)) {
      return "home";
    }
  } catch {
    // ignore invalid URLs
  }
  return "other";
}

export function checkoutStepFromPath(url: string): string | undefined {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes("/checkout/review")) {
      return "review";
    }
    if (path.includes("/checkout/shipping")) {
      return "shipping";
    }
    if (path.includes("/checkout/payment")) {
      return "payment";
    }
    if (path.includes("/checkout/place")) {
      return "place-order";
    }
  } catch {
    // ignore invalid URLs
  }
  return undefined;
}
