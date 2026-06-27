import { describe, expect, it } from "vitest";

import { getChannelDomains, upsertChannelDomains } from "@ext/lib/channel-targets.ts";
import { DEFAULT_SETTINGS } from "@ext/types/index.ts";
import { buildChannelTarget } from "./fixtures.ts";

describe("getChannelDomains", () => {
  it("returns domains for a configured channel", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "111", allowed_domains: ["a.com"] })],
    };
    expect(getChannelDomains(settings, "111")).toEqual(["a.com"]);
  });

  it("returns empty array for unknown channel", () => {
    expect(getChannelDomains(DEFAULT_SETTINGS, "999")).toEqual([]);
  });
});

describe("upsertChannelDomains", () => {
  it("adds a new channel entry", () => {
    const result = upsertChannelDomains(DEFAULT_SETTINGS, "111", ["walmart.com"]);
    expect(result.channel_targets).toEqual([
      { channel_id: "111", allowed_domains: ["walmart.com"] },
    ]);
  });

  it("updates an existing channel entry", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "111", allowed_domains: ["a.com"] })],
    };
    const result = upsertChannelDomains(settings, "111", ["b.com", "c.com"]);
    expect(result.channel_targets).toEqual([
      { channel_id: "111", allowed_domains: ["b.com", "c.com"] },
    ]);
  });

  it("prunes entry when domains is empty", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "111" })],
    };
    const result = upsertChannelDomains(settings, "111", []);
    expect(result.channel_targets).toEqual([]);
  });

  it("dedupes and normalizes domains", () => {
    const result = upsertChannelDomains(DEFAULT_SETTINGS, "111", [
      "https://www.walmart.com",
      "walmart.com",
      "WALMART.COM",
    ]);
    expect(result.channel_targets[0]?.allowed_domains).toEqual(["walmart.com"]);
  });

  it("preserves other channel entries", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({ channel_id: "111", allowed_domains: ["a.com"] }),
        buildChannelTarget({ channel_id: "222", allowed_domains: ["b.com"] }),
      ],
    };
    const result = upsertChannelDomains(settings, "111", ["c.com"]);
    expect(result.channel_targets).toEqual([
      { channel_id: "222", allowed_domains: ["b.com"] },
      { channel_id: "111", allowed_domains: ["c.com"] },
    ]);
  });
});
