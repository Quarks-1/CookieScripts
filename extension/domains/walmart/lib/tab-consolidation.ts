export function isQpUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path === "/qp" || path.startsWith("/qp/");
  } catch {
    return false;
  }
}

export function isWalmartHomeUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path === "/" || path === "";
  } catch {
    return false;
  }
}

export type WalmartTabInfo = {
  id: number;
  url?: string;
};

export function planTabConsolidation(
  tabs: WalmartTabInfo[],
  homepageTabId?: number,
): number[] {
  const qpTabs = tabs
    .filter((t): t is WalmartTabInfo & { id: number; url: string } =>
      Boolean(t.url && isQpUrl(t.url) && t.id != null),
    )
    .sort((a, b) => a.id - b.id);

  if (homepageTabId != null) {
    return qpTabs.map((t) => t.id);
  }
  if (qpTabs.length <= 1) {
    return [];
  }
  return qpTabs.slice(1).map((t) => t.id);
}
