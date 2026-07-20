/** Read Glass cart id (`ca-{uuid}`) from Sam's Club localStorage. */
export function readSamsclubCartId(storage?: Storage | null): string | null {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem("glassCartIdMap");
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string" && parsed.startsWith("ca-")) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (typeof value === "string" && value.startsWith("ca-")) {
          return value;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function buildCheckoutReviewOrderUrl(cartId: string): string {
  const params = new URLSearchParams({ cartId });
  return `https://www.samsclub.com/checkout/review-order?${params.toString()}`;
}
