import { unwrapAffiliateUrl } from "@ext/core/lib/affiliate-unwrap.ts";
import { hostMatches } from "@ext/core/lib/links.ts";
import { RETAILER_HOST } from "@ext/domains/target/lib/host.ts";
import { AUTH_SIGN_IN_FLYOUT_SELECTOR } from "@ext/domains/target/lib/checkout/selectors.ts";

const CHECKOUT_UNAVAILABLE_TEXT =
  "we're sorry! this page is currently unavailable. please try again later.";

export function pathnameFromUrl(url: string): string {
  try {
    return new URL(unwrapAffiliateUrl(url)).pathname;
  } catch {
    return "";
  }
}

export function isRetailerCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    if (!hostMatches(parsed.hostname, RETAILER_HOST)) {
      return false;
    }
    return parsed.pathname.startsWith("/checkout");
  } catch {
    return false;
  }
}

export function isOrderConfirmationUrl(url: string): boolean {
  try {
    const parsed = new URL(unwrapAffiliateUrl(url));
    if (!hostMatches(parsed.hostname, RETAILER_HOST)) {
      return false;
    }
    return parsed.pathname.startsWith("/order-confirmation");
  } catch {
    return false;
  }
}

/** Checkout automation may run on checkout steps or order confirmation. */
export function isCheckoutAutomationUrl(url: string): boolean {
  return isRetailerCheckoutUrl(url) || isOrderConfirmationUrl(url);
}

export function isCheckoutAuthRequiredPage(doc: Document = document): boolean {
  return doc.querySelector(AUTH_SIGN_IN_FLYOUT_SELECTOR) !== null;
}

export function isCheckoutHardErrorPage(doc: Document = document): boolean {
  const bodyText = doc.body?.textContent?.toLowerCase() ?? "";
  if (bodyText.includes(CHECKOUT_UNAVAILABLE_TEXT)) {
    return true;
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
