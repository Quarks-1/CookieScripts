import type { EmbeddedDataHints } from "@ext/domains/samsclub/types/samsclub.ts";

function readJsonScript(doc: Document, id: string): unknown {
  const el = doc.getElementById(id);
  if (!el?.textContent?.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(el.textContent) as unknown;
  } catch {
    return undefined;
  }
}

export function parseEmbeddedDataHints(doc: Document = document): EmbeddedDataHints | undefined {
  const nextData = readJsonScript(doc, "__NEXT_DATA__") as
    | { page?: string; props?: { pageProps?: Record<string, unknown> } }
    | undefined;
  if (!nextData) {
    return undefined;
  }
  const pageProps = nextData.props?.pageProps ?? {};
  const hints: EmbeddedDataHints = {};
  if (typeof nextData.page === "string") {
    hints.page = nextData.page;
  }
  const itemId =
    (pageProps.usItemId as string | undefined) ??
    (pageProps.itemId as string | undefined) ??
    (pageProps.productId as string | undefined);
  if (itemId) {
    hints.itemId = String(itemId);
  }
  if (typeof pageProps.offerId === "string") {
    hints.offerId = pageProps.offerId;
  }
  if (typeof pageProps.availabilityStatus === "string") {
    hints.availabilityStatus = pageProps.availabilityStatus;
  }
  return Object.keys(hints).length > 0 ? hints : undefined;
}
