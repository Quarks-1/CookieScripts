import { beforeEach, describe, expect, it, vi } from "vitest";

import { isWalmartContentSender } from "@ext/core/background/sender-auth.ts";
import { mockExtensionPageSender, mockRetailerContentSender } from "../fixtures/fixtures.ts";

const EXTENSION_ID = "test-extension-id";

describe("walmart sender auth", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", { runtime: { id: EXTENSION_ID } });
  });

  it("accepts walmart tab senders", () => {
    const sender = {
      id: EXTENSION_ID,
      tab: { id: 1, url: "https://www.walmart.com/ip/foo" } as chrome.tabs.Tab,
    };
    expect(isWalmartContentSender(sender)).toBe(true);
  });

  it("rejects target tab senders", () => {
    expect(isWalmartContentSender(mockRetailerContentSender())).toBe(false);
  });

  it("rejects extension page senders", () => {
    expect(isWalmartContentSender(mockExtensionPageSender())).toBe(false);
  });
});
