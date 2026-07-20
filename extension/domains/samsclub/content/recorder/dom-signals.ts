export function scanDomSignals(root: ParentNode = document): string[] {
  const signals: string[] = [];

  if (root.querySelector("#px-captcha, [id='px-captcha']")) {
    signals.push("px_captcha");
  }
  const path = location.pathname.toLowerCase();
  if (path.includes("/blocked") || path.includes("/are-you-human")) {
    signals.push("px_blocked_url");
  }
  if (/let us know you're not a robot/i.test(document.title)) {
    signals.push("px_human_challenge_page");
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
  if (
    (bodyText.includes("hold tight") && bodyText.includes("high traffic")) ||
    bodyText.includes("we'll load this page when it's ready") ||
    (bodyText.includes("highly requested") && bodyText.includes("refresh when available"))
  ) {
    signals.push("throttle_page");
  }
  if (
    root.querySelector('[data-testid="queue-banner"]') ||
    /you're in line/i.test(bodyText)
  ) {
    signals.push("queue_banner");
  }

  return signals;
}
