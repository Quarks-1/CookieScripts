import { parseEmbeddedDataHints } from "@ext/domains/samsclub/content/recorder/next-data-hints.ts";

const OFFER_ID_PATTERN = /"offerId"\s*:\s*"([A-F0-9]{32})"/gi;

export function readOfferIdFromUrl(url: string): string | null {
  try {
    const oId = new URL(url).searchParams.get("oId");
    return oId && /^[A-F0-9]{32}$/i.test(oId) ? oId : null;
  } catch {
    return null;
  }
}

export function readOfferIdFromNextData(doc: Document, usItemId: string): string | null {
  const nextData = doc.getElementById("__NEXT_DATA__")?.textContent;
  if (!nextData?.includes(usItemId)) {
    return null;
  }

  const matches = [...nextData.matchAll(OFFER_ID_PATTERN)].map((match) => match[1]);
  return matches[0] ?? null;
}

export function readOfferIdFromPage(doc: Document, usItemId: string): string | null {
  const hints = parseEmbeddedDataHints(doc);
  if (hints?.offerId) {
    return hints.offerId;
  }

  const fromUrl = readOfferIdFromUrl(doc.defaultView?.location.href ?? "");
  if (fromUrl) {
    return fromUrl;
  }

  return readOfferIdFromNextData(doc, usItemId);
}
