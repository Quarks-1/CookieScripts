import { formatCatalogPrice } from "@ext/core/lib/catalog/group.ts";

const PRODUCT_PRICE_SELECTOR = '[data-test="product-price"]';
const PRICE_TEXT_PATTERN = /\$(\d+(?:\.\d{2})?)/;

const PRODUCT_CONTEXT_KEYS = new Set(["product", "item", "price"]);

export function parsePriceTextToCents(text: string): number | null {
  const match = text.match(PRICE_TEXT_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  const dollars = Number(match[1]);
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return null;
  }
  return Math.round(dollars * 100);
}

function parseTcinFromProductUrl(url: string): string | null {
  const match = url.match(/\/A-(\d+)(?:\b|[/?#]|$)/);
  return match?.[1] ?? null;
}

function nextDataMatchesPageTcin(text: string, pageUrl: string): boolean {
  const tcin = parseTcinFromProductUrl(pageUrl);
  if (!tcin) {
    return true;
  }
  return (
    text.includes(`"tcin":"${tcin}"`) ||
    text.includes(`"tcin": "${tcin}"`) ||
    text.includes(`"tcin":${tcin}`)
  );
}

function parseRetailCentsValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    const cents = Math.round(raw);
    return cents >= 1 ? cents : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = parsePriceTextToCents(raw);
    if (parsed != null) {
      return parsed;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      const cents = Math.round(numeric);
      return cents >= 1 ? cents : null;
    }
  }
  return null;
}

function findPriceInValue(value: unknown, underPrice = false): number | null {
  if (value == null || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPriceInValue(item, underPrice);
      if (found != null) {
        return found;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const nextUnderPrice = underPrice || record.price != null;

  if (nextUnderPrice || "current_retail" in record || "formatted_current_price" in record) {
    const currentRetail = parseRetailCentsValue(record.current_retail);
    if (currentRetail != null) {
      return currentRetail;
    }
    const currentRetailMin = parseRetailCentsValue(record.current_retail_min);
    if (currentRetailMin != null) {
      return currentRetailMin;
    }
    const formatted = parseRetailCentsValue(record.formatted_current_price);
    if (formatted != null) {
      return formatted;
    }
  }

  for (const [key, child] of Object.entries(record)) {
    const childUnderPrice = nextUnderPrice || PRODUCT_CONTEXT_KEYS.has(key);
    const found = findPriceInValue(child, childUnderPrice);
    if (found != null) {
      return found;
    }
  }

  return null;
}

export function readProductPriceCentsFromNextDataText(
  text: string,
  pageUrl = "",
): number | null {
  if (pageUrl && !nextDataMatchesPageTcin(text, pageUrl)) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return findPriceInValue(parsed);
  } catch {
    return findPriceInValue(text);
  }
}

export function readProductPriceCentsFromNextData(
  doc: Document,
  pageUrl = doc.location?.href ?? "",
): number | null {
  const script = doc.getElementById("__NEXT_DATA__");
  if (!script?.textContent) {
    return null;
  }
  return readProductPriceCentsFromNextDataText(script.textContent, pageUrl);
}

export function readProductPriceCentsFromDom(doc: Document): number | null {
  const priceEl = doc.querySelector(PRODUCT_PRICE_SELECTOR);
  if (!priceEl?.textContent) {
    return null;
  }
  return parsePriceTextToCents(priceEl.textContent);
}

export function readProductPriceCentsForAutomation(
  doc: Document,
  pageUrl = doc.location?.href ?? "",
): number | null {
  return (
    readProductPriceCentsFromNextData(doc, pageUrl) ??
    readProductPriceCentsFromDom(doc)
  );
}

export function formatPriceGateMismatch(liveCents: number, expectedCents: number): string {
  return `Price gate: ${formatCatalogPrice(liveCents)} ≠ ${formatCatalogPrice(expectedCents)}`;
}
