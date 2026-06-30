const BLOCKED_DOMAINS = new Set([
  "discord.com",
  "discordapp.com",
  "discord.gg",
  "discordapp.net",
  "discord.media",
  "discord.co",
  "discord.new",
  "discord.gift",
  "discordstatus.com",
  "discord-attachments-uploads-prd.storage.googleapis.com",
]);

/** CDNs and generic shorteners that are not retailer-specific redirect wrappers. */
const BLOCKED_SUGGESTION_SUFFIXES = [
  "scene7.com",
  "geni.us",
  "amzn.to",
  "a.co",
  "bit.ly",
  "t.co",
  "ow.ly",
  "tinyurl.com",
  "buff.ly",
] as const;

export function isBlockedSuggestionDomain(domain: string): boolean {
  if (BLOCKED_DOMAINS.has(domain)) {
    return true;
  }
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain.endsWith("." + blocked)) {
      return true;
    }
  }
  for (const suffix of BLOCKED_SUGGESTION_SUFFIXES) {
    if (domain === suffix || domain.endsWith("." + suffix)) {
      return true;
    }
  }
  return false;
}
