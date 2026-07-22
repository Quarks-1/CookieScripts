export function isBlockedPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path.includes("/blocked") || path.includes("/are-you-human");
}

export function isQueueWaitCopy(bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  return (
    text.includes("almost gone") ||
    text.includes("hang tight- we'll notify") ||
    text.includes("hold my spot") ||
    /you're in line/i.test(text)
  );
}

export function isThrottleCopy(bodyText: string): boolean {
  const text = bodyText.toLowerCase();
  if (text.includes("hold tight for a moment")) {
    return true;
  }
  if (text.includes("highly requested") && text.includes("refresh when available")) {
    return true;
  }
  if (text.includes("we'll load this page when it's ready")) {
    return true;
  }
  if (
    text.includes("hold tight") &&
    (text.includes("high traffic") || text.includes("load this page when it's ready"))
  ) {
    return true;
  }
  return false;
}

export function isThrottlePage(options: { bodyText: string; pathname: string }): boolean {
  if (isBlockedPath(options.pathname)) {
    return false;
  }
  if (isQueueWaitCopy(options.bodyText)) {
    return false;
  }
  return isThrottleCopy(options.bodyText);
}
