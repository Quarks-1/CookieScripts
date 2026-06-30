/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isDiscordContentSender,
  isRetailerContentSender,
} from "@ext/core/background/sender-auth.ts";

const EXTENSION_ID = "test-extension-id";

describe("sender auth", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", { runtime: { id: EXTENSION_ID } });
  });
  it("accepts discord content senders", () => {
    expect(
      isDiscordContentSender({
        id: EXTENSION_ID,
        tab: { id: 1, url: "https://discord.com/channels/1/2" } as chrome.tabs.Tab,
      }),
    ).toBe(true);
  });

  it("rejects retailer tabs for discord auth", () => {
    expect(
      isDiscordContentSender({
        id: EXTENSION_ID,
        tab: { id: 1, url: "https://www.target.com/p/item" } as chrome.tabs.Tab,
      }),
    ).toBe(false);
  });

  it("accepts target.com retailer senders", () => {
    expect(
      isRetailerContentSender({
        id: EXTENSION_ID,
        tab: { id: 2, url: "https://www.target.com/p/item" } as chrome.tabs.Tab,
      }),
    ).toBe(true);
  });

  it("rejects discord tabs for retailer auth", () => {
    expect(
      isRetailerContentSender({
        id: EXTENSION_ID,
        tab: { id: 1, url: "https://discord.com/channels/1/2" } as chrome.tabs.Tab,
      }),
    ).toBe(false);
  });
});
