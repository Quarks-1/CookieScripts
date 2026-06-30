import type { EmbeddedPageData } from "@ext/domains/walmart/types/walmart.ts";
import { parseNextDataHints } from "@ext/domains/walmart/content/recorder/next-data-hints.ts";

export function extractEmbeddedPageData(doc: Document = document): EmbeddedPageData {
  const jsonLd: string[] = [];
  for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const text = node.textContent?.trim();
    if (text) {
      jsonLd.push(text.slice(0, 32_768));
    }
    if (jsonLd.length >= 5) {
      break;
    }
  }

  const nextScript = doc.getElementById("__NEXT_DATA__");
  const nextData = nextScript?.textContent?.trim()
    ? nextScript.textContent.trim().slice(0, 256_000)
    : undefined;

  return {
    nextData,
    nextDataHints: parseNextDataHints(doc),
    jsonLd,
  };
}
