import type { WalmartRecordingEvent } from "@ext/domains/walmart/types/walmart.ts";

function isWalmartResearchUrl(hostname: string, pathname: string): boolean {
  if (hostname.endsWith("walmart.com")) {
    return (
      pathname.includes("/orchestra/") ||
      pathname.includes("/graphql") ||
      pathname.includes("/swag/") ||
      pathname.startsWith("/api/")
    );
  }
  return hostname.endsWith("px-cloud.net");
}

export function shouldCatalogNetworkEvent(
  event: Extract<WalmartRecordingEvent, { kind: "network" }>,
): boolean {
  if (event.transport === "resource") {
    return false;
  }
  const url = event.absoluteUrl ?? event.url;
  try {
    const parsed = new URL(url, "https://www.walmart.com");
    return isWalmartResearchUrl(parsed.hostname, parsed.pathname);
  } catch {
    return false;
  }
}
