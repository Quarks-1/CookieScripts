import type { ChannelTarget } from "@ext/types/index.ts";

export function buildChannelTarget(overrides: Partial<ChannelTarget> = {}): ChannelTarget {
  return {
    channel_id: "1234567890123456789",
    allowed_domains: ["walmart.com"],
    ...overrides,
  };
}

export function mockContentSender(overrides: {
  tabId?: number;
  tabUrl?: string;
  extensionId?: string;
} = {}): chrome.runtime.MessageSender {
  const extensionId = overrides.extensionId ?? "test-extension-id";
  const tabId = overrides.tabId ?? 1;
  const tabUrl = overrides.tabUrl ?? "https://discord.com/channels/111/222";
  return {
    id: extensionId,
    tab: {
      id: tabId,
      url: tabUrl,
    } as chrome.tabs.Tab,
  };
}

export function mockExtensionPageSender(extensionId = "test-extension-id"): chrome.runtime.MessageSender {
  return {
    id: extensionId,
    url: `chrome-extension://${extensionId}/ui/popup/index.html`,
  };
}
