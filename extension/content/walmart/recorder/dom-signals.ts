export function scanDomSignals(root: ParentNode = document): string[] {
  const signals: string[] = [];

  if (root.querySelector("#px-captcha, [id='px-captcha']")) {
    signals.push("px_captcha");
  }
  if (location.pathname.toLowerCase().includes("/blocked")) {
    signals.push("px_blocked_url");
  }
  if (root.querySelector('[data-testid="add-to-cart-skeleton"]')) {
    signals.push("atc_skeleton");
  }
  const atcButton = root.querySelector('[data-automation-id="add-to-cart-button"]');
  if (atcButton?.getAttribute("aria-disabled") === "true") {
    signals.push("atc_disabled");
  }

  const bodyText = (document.body?.innerText ?? "").toLowerCase();
  for (const phrase of ["out of stock", "sold out", "get in-stock alert"]) {
    if (bodyText.includes(phrase)) {
      signals.push(`oos:${phrase}`);
      break;
    }
  }
  if (root.querySelector('[data-testid="pciContent"] iframe, [data-testid="pciContent"]')) {
    signals.push("payment_iframe_mount");
  }
  if (bodyText.includes("continue as guest")) {
    signals.push("guest_checkout");
  }

  return signals;
}
