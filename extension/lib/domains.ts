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
