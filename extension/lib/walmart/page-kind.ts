import type { WalmartPageKind } from "@ext/types/walmart.ts";

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
  return path === "/" || path === "/browse" || path.startsWith("/browse/");
}

export function classifyWalmartPageKind(url: string): WalmartPageKind {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes("/blocked")) {
      return "blocked";
    }
    if (path.includes("/queue") || path.includes("waitingroom") || path.includes("waiting-room")) {
      return "queue";
    }
    if (path === "/search" || path.startsWith("/search/")) {
      return "search";
    }
    if (/\/ip\/[^/]+/.test(path)) {
      return "product";
    }
    if (path === "/pac" || path.startsWith("/pac/")) {
      return "pac";
    }
    if (path === "/cart" || path.startsWith("/cart/")) {
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
    if (path.includes("/checkout/review-order")) {
      return "review-order";
    }
    if (path.includes("/checkout/shipping")) {
      return "shipping";
    }
    if (path.includes("/checkout/payment")) {
      return "payment";
    }
    if (path.includes("/checkout/place-order")) {
      return "place-order";
    }
  } catch {
    // ignore invalid URLs
  }
  return undefined;
}
