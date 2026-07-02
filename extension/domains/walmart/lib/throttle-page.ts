export const WALMART_THROTTLE_LOADING_MS = 5_000;

export function isBlockedOrCheckoutPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (path.includes("/blocked")) {
    return true;
  }
  return path.includes("/checkout");
}

export function isQueueWaitCopy(bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  return (
    text.includes("almost gone") ||
    text.includes("hang tight- we'll notify") ||
    text.includes("hold my spot")
  );
}

export function isThrottleCopy(bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  if (text.includes("highly requested") && text.includes("refresh when available")) {
    return true;
  }
  if (text.includes("we'll load this page when it's ready")) {
    return true;
  }
  if (text.includes("hold tight") && (text.includes("high traffic") || text.includes("load this page when it's ready"))) {
    return true;
  }
  return false;
}

export function isLoadingShell(mainContentText: string): boolean {
  return mainContentText.includes("Loading…") || mainContentText.includes("Loading...");
}

export function isThrottlePage(options: {
  bodyText: string;
  pathname: string;
  loadingSinceMs?: number;
  mainContentText?: string;
}): boolean {
  const path = options.pathname.toLowerCase();
  if (isBlockedOrCheckoutPath(path)) {
    return false;
  }
  if (isQueueWaitCopy(options.bodyText)) {
    return false;
  }
  if (isThrottleCopy(options.bodyText)) {
    return true;
  }
  const onQpOrPdp = path === "/qp" || path.startsWith("/qp/") || /\/ip\//.test(path);
  if (
    onQpOrPdp &&
    options.mainContentText != null &&
    isLoadingShell(options.mainContentText) &&
    options.loadingSinceMs != null &&
    options.loadingSinceMs >= WALMART_THROTTLE_LOADING_MS
  ) {
    return true;
  }
  return false;
}
