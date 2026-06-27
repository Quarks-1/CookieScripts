export interface DomainPill {
  domain: string;
  enabled: boolean;
}

export function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const host = withoutProtocol.split("/")[0]?.replace(/^www\./, "") ?? "";
  if (!host || !host.includes(".")) {
    return null;
  }
  return host;
}

export function pillsFromDomains(domains: string[]): DomainPill[] {
  return domains.map((domain) => ({ domain, enabled: true }));
}

export function enabledDomains(pills: DomainPill[]): string[] {
  return pills.filter((pill) => pill.enabled).map((pill) => pill.domain);
}
