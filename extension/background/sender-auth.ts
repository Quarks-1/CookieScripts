export function isDiscordContentSender(sender: chrome.runtime.MessageSender): boolean {
  return (
    sender.id === chrome.runtime.id &&
    sender.tab?.id != null &&
    sender.tab.url?.startsWith("https://discord.com/") === true
  );
}

export function isRetailerContentSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || sender.tab?.id == null || !sender.tab.url) {
    return false;
  }
  try {
    const host = new URL(sender.tab.url).hostname.toLowerCase();
    return host === "target.com" || host === "www.target.com" || host.endsWith(".target.com");
  } catch {
    return false;
  }
}

export function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  return (
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) === true
  );
}
