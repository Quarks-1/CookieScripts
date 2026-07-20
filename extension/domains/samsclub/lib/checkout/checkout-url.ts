import { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";
import { hostMatches } from "@ext/core/lib/links.ts";
import { isSamsclubProductUrl, SAMSCLUB_HOST } from "@ext/domains/samsclub/lib/host.ts";
import { AUTH_SIGN_IN_FLYOUT_SELECTOR, CHECKOUT_CONTAINER_SELECTOR, PLACE_ORDER_BUTTON_SELECTOR } from "@ext/domains/samsclub/lib/checkout/selectors.ts";
import { isElementActionable } from "@ext/domains/samsclub/lib/dom.ts";

const CHECKOUT_UNAVAILABLE_TEXT =
  "we're sorry! this page is currently unavailable. please try again later.";

export function pathnameFromUrl(url: string): string {
  try {
    return new URL(unwrapAffiliateUrl(url)).pathname;
  } catch {
    return "";
  }
}

export function isSamsclubCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    if (!hostMatches(parsed.hostname, SAMSCLUB_HOST)) {
      return false;
    }
    return parsed.pathname.startsWith("/checkout");
  } catch {
    return false;
  }
}

/** Final checkout step where CVV + Place order run (payment section may hydrate after the button). */
export function isSamsclubReviewOrderUrl(url: string): boolean {
  return pathnameFromUrl(url).startsWith("/checkout/review-order");
}

export function isOrderConfirmationUrl(url: string): boolean {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    if (!hostMatches(parsed.hostname, SAMSCLUB_HOST)) {
      return false;
    }
    const path = parsed.pathname.toLowerCase();
    return (
      path.startsWith("/thankyou") ||
      path.startsWith("/thank-you") ||
      path.startsWith("/order-confirmation") ||
      path.startsWith("/purchase-confirmation") ||
      path.includes("/orderplaced")
    );
  } catch {
    return false;
  }
}

/** Checkout automation may run on checkout steps or order confirmation. */
export function isCheckoutAutomationUrl(url: string): boolean {
  return isSamsclubCheckoutUrl(url) || isOrderConfirmationUrl(url);
}

/** In-flight PDP → cart/pac → checkout hops while checkout resume is active. */
export function isCheckoutHandoffTransitUrl(url: string): boolean {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    if (!hostMatches(parsed.hostname, SAMSCLUB_HOST)) {
      return false;
    }
    const path = parsed.pathname.toLowerCase();
    return (
      path === "/cart" ||
      path.startsWith("/cart/") ||
      path === "/pac" ||
      path.startsWith("/pac/")
    );
  } catch {
    return false;
  }
}

export function readySamsclubAutoModeMessage(pageUrl: string): string {
  if (
    isSamsclubProductUrl(pageUrl) ||
    (isSamsclubCheckoutUrl(pageUrl) && !isOrderConfirmationUrl(pageUrl))
  ) {
    return "Ready — press Start Auto Mode";
  }
  return "Ready — open a product page and press Start";
}

export function isCheckoutAuthRequiredPage(doc: Document = document): boolean {
  const el = doc.querySelector(AUTH_SIGN_IN_FLYOUT_SELECTOR);
  return el instanceof HTMLElement && isElementActionable(el);
}

/** Skeleton / spinner overlay — checkout DOM is not interactive yet. */
export function isCheckoutPageLoading(doc: Document = document): boolean {
  if (doc.querySelector('[data-test="checkout-loading-skeleton"]')) {
    return true;
  }
  const spinner = doc.querySelector('[data-test="spinnerOverlayContainer"]');
  if (spinner?.getAttribute("data-visible") === "true") {
    return true;
  }
  if (spinner instanceof HTMLElement && isElementActionable(spinner)) {
    return true;
  }
  return false;
}

export function isCheckoutHardErrorPage(doc: Document = document): boolean {
  if (isCheckoutPageLoading(doc)) {
    return false;
  }

  const bodyText = doc.body?.textContent?.toLowerCase() ?? "";
  if (bodyText.includes(CHECKOUT_UNAVAILABLE_TEXT)) {
    return true;
  }

  // Once review-order UI is present, let CVV / place-order automation run; overlays
  // and skeleton nodes often linger in the DOM without blocking checkout.
  if (isCheckoutShellLoaded(doc)) {
    return false;
  }

  const spinner = doc.querySelector('[data-test="spinnerOverlayContainer"]');
  if (spinner?.getAttribute("data-visible") === "true") {
    return true;
  }

  if (doc.querySelector('[data-test="checkout-loading-skeleton"]')) {
    return true;
  }

  return false;
}

function isCheckoutShellLoaded(doc: Document): boolean {
  if (isCheckoutPageLoading(doc)) {
    return false;
  }
  if (doc.querySelector(CHECKOUT_CONTAINER_SELECTOR)) {
    return true;
  }
  return doc.querySelector(PLACE_ORDER_BUTTON_SELECTOR) !== null;
}
