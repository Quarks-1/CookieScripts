import { isHttpOrHttpsUrl } from "@ext/core/lib/links.ts";
import type { MessageAnchor, SkuWatchProfile } from "@ext/core/lib/sku-watch/types.ts";

export function resolvePrimaryLink(
  anchors: MessageAnchor[],
  urls: string[],
  profile: SkuWatchProfile,
): string | null {
  for (const anchor of anchors) {
    if (!isHttpOrHttpsUrl(anchor.href)) {
      continue;
    }
    if (!profile.isAuxiliaryLink(anchor.href, anchor.text)) {
      return anchor.href;
    }
  }

  for (const url of urls) {
    if (!isHttpOrHttpsUrl(url)) {
      continue;
    }
    if (!profile.isAuxiliaryLink(url, "")) {
      return url;
    }
  }

  return null;
}
