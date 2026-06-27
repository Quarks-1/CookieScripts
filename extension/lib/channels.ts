export function parseChannelId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "channels" || !parts[2]) {
    return null;
  }
  if (!/^\d+$/.test(parts[2])) {
    return null;
  }
  return parts[2];
}

export function resolveContentChannel(
  sender: chrome.runtime.MessageSender,
  payloadChannelId?: string,
): string | null {
  const tabUrl = sender.tab?.url;
  if (!tabUrl?.startsWith("https://discord.com/channels/")) {
    return null;
  }
  let pathname: string;
  try {
    pathname = new URL(tabUrl).pathname;
  } catch {
    return null;
  }
  const channelId = parseChannelId(pathname);
  if (!channelId) {
    return null;
  }
  if (payloadChannelId !== undefined && payloadChannelId !== channelId) {
    return null;
  }
  return channelId;
}
