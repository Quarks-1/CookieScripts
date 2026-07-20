import type { SamsclubRecordingEvent } from "@ext/domains/samsclub/types/samsclub.ts";

function isSamsclubResearchUrl(hostname: string, pathname: string): boolean {
  if (hostname.endsWith("samsclub.com")) {
    return (
      pathname.includes("/orchestra/") ||
      pathname.includes("/graphql") ||
      pathname.includes("/api/")
    );
  }
  return false;
}

export function shouldCatalogNetworkEvent(
  event: Extract<SamsclubRecordingEvent, { kind: "network" }>,
): boolean {
  if (event.transport === "resource") {
    return false;
  }
  const url = event.absoluteUrl ?? event.url;
  try {
    const parsed = new URL(url, "https://www.samsclub.com");
    return isSamsclubResearchUrl(parsed.hostname, parsed.pathname);
  } catch {
    return false;
  }
}
