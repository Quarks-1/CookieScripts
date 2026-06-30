import type { NextDataHints } from "@ext/types/walmart.ts";

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseNextDataHints(doc: Document = document): NextDataHints | undefined {
  const raw = doc.getElementById("__NEXT_DATA__")?.textContent;
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const page = parsed.page as string | undefined;
    const props = parsed.props as Record<string, unknown> | undefined;
    const pageProps = props?.pageProps as Record<string, unknown> | undefined;
    const initialData = pageProps?.initialData as Record<string, unknown> | undefined;
    const product = initialData?.product as Record<string, unknown> | undefined;
    const data = product?.data as Record<string, unknown> | undefined;
    const productData = data?.product as Record<string, unknown> | undefined;
    const checkout = pageProps?.checkout as Record<string, unknown> | undefined;

    const hints: NextDataHints = {
      page,
      usItemId: asString(productData?.usItemId),
      offerId: asString(readPath(productData, ["offerId"])),
      availabilityStatus: asString(readPath(productData, ["availabilityStatus"])),
      cartId: asString(checkout?.cartId ?? pageProps?.cartId),
      pcid: asString(checkout?.pcid ?? pageProps?.pcid),
    };

    const hasValue = Object.values(hints).some((value) => value != null);
    return hasValue ? hints : { page };
  } catch {
    return undefined;
  }
}
