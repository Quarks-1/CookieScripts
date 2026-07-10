import { describe, expect, it } from "vitest";

import {
  addChannelDomain,
  getChannelDomains,
  getChannelKeywords,
  upsertChannelDiscordTarget,
  upsertChannelDomains,
  upsertChannelKeywords,
} from "@ext/core/lib/channel-targets.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { buildChannelTarget } from "../fixtures/fixtures.ts";

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

  it("preserves retailer_auto_atc_enabled when domains are updated", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    const result = upsertChannelDomains(settings, "111", ["target.com", "amazon.com"]);
    expect(result.channel_targets[0]).toEqual({
      channel_id: "111",
      allowed_domains: ["target.com", "amazon.com"],
      retailer_auto_atc_enabled: true,
    });
  });

  it("preserves retailer_auto_atc_enabled when target.com is removed", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          allowed_domains: ["target.com"],
          retailer_auto_atc_enabled: true,
        }),
      ],
    };
    const result = upsertChannelDomains(settings, "111", ["mavely.app.link"]);
    expect(result.channel_targets[0]?.retailer_auto_atc_enabled).toBe(true);
  });

  it("preserves keywords when domains are updated", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          allowed_domains: ["walmart.com"],
          positive_keywords: ["pokemon"],
          negative_keywords: ["scam"],
        }),
      ],
    };
    const result = upsertChannelDomains(settings, "111", ["walmart.com", "target.com"]);
    expect(result.channel_targets[0]).toEqual({
      channel_id: "111",
      allowed_domains: ["walmart.com", "target.com"],
      positive_keywords: ["pokemon"],
      negative_keywords: ["scam"],
    });
  });
});

describe("getChannelKeywords", () => {
  it("returns empty lists for unknown channel", () => {
    expect(getChannelKeywords(DEFAULT_SETTINGS, "999")).toEqual({
      positive: [],
      negative: [],
    });
  });

  it("returns stored keyword lists", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          positive_keywords: ["pokemon"],
          negative_keywords: ["scam"],
        }),
      ],
    };
    expect(getChannelKeywords(settings, "111")).toEqual({
      positive: ["pokemon"],
      negative: ["scam"],
    });
  });
});

describe("upsertChannelDiscordTarget", () => {
  it("preserves watch_skus when target_skus omitted from patch", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          allowed_domains: ["walmart.com"],
          watch_skus: { target: ["95120834"] },
        }),
      ],
    };
    const result = upsertChannelDiscordTarget(settings, "111", {
      allowed_domains: ["walmart.com"],
      positive_keywords: ["pokemon"],
      negative_keywords: [],
    });
    expect(result.channel_targets[0]?.watch_skus).toEqual({ target: ["95120834"] });
  });

  it("stores normalized keywords and SKUs", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "111", allowed_domains: ["walmart.com"] })],
    };
    const result = upsertChannelDiscordTarget(settings, "111", {
      allowed_domains: ["walmart.com"],
      positive_keywords: ["Pokemon"],
      negative_keywords: ["  Scam  Link  "],
      target_skus: ["95120834", "94860231"],
    });
    expect(result.channel_targets[0]).toEqual({
      channel_id: "111",
      allowed_domains: ["walmart.com"],
      positive_keywords: ["pokemon"],
      negative_keywords: ["scam link"],
      watch_skus: { target: ["95120834", "94860231"] },
    });
  });

  it("omits empty keyword arrays", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [
        buildChannelTarget({
          channel_id: "111",
          allowed_domains: ["walmart.com"],
          positive_keywords: ["pokemon"],
        }),
      ],
    };
    const result = upsertChannelDiscordTarget(settings, "111", {
      allowed_domains: ["walmart.com"],
      positive_keywords: [],
      negative_keywords: [],
    });
    expect(result.channel_targets[0]).toEqual({
      channel_id: "111",
      allowed_domains: ["walmart.com"],
    });
  });
});

describe("upsertChannelKeywords", () => {
  it("throws when channel has no domains", () => {
    expect(() => upsertChannelKeywords(DEFAULT_SETTINGS, "111", ["pokemon"], [])).toThrow(
      /allowed domain/i,
    );
  });
});

describe("addChannelDomain", () => {
  it("appends a domain without duplicates", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "111", allowed_domains: ["a.com"] })],
    };
    const once = addChannelDomain(settings, "111", "b.com");
    expect(getChannelDomains(once, "111")).toEqual(["a.com", "b.com"]);
    const twice = addChannelDomain(once, "111", "https://www.b.com");
    expect(getChannelDomains(twice, "111")).toEqual(["a.com", "b.com"]);
  });
});
