import { describe, expect, it } from "vitest";

import {
  addChannelDomain,
  getChannelDomains,
  getGlobalKeywords,
  getGlobalWatchSkus,
  stripChannelWatchFields,
  upsertChannelDomains,
  upsertGlobalWatchSettings,
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
});

describe("getGlobalKeywords", () => {
  it("returns empty lists when unset", () => {
    expect(getGlobalKeywords(DEFAULT_SETTINGS, "target")).toEqual({
      positive: [],
      negative: [],
    });
  });

  it("returns stored watch_keywords for retailer", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      watch_keywords: {
        target: { positive: ["pokemon"], negative: ["scam"] },
        walmart: { positive: ["walmart-only"], negative: [] },
      },
    };
    expect(getGlobalKeywords(settings, "target")).toEqual({
      positive: ["pokemon"],
      negative: ["scam"],
    });
    expect(getGlobalKeywords(settings, "walmart")).toEqual({
      positive: ["walmart-only"],
      negative: [],
    });
  });
});

describe("upsertGlobalWatchSettings", () => {
  it("stores normalized keywords and SKUs globally", () => {
    const result = upsertGlobalWatchSettings(DEFAULT_SETTINGS, {
      target_positive_keywords: ["Pokemon"],
      target_negative_keywords: ["  Scam  Link  "],
      walmart_positive_keywords: ["deal"],
      walmart_negative_keywords: [],
      target_skus: ["95120834", "94860231"],
    });
    expect(result.watch_keywords).toEqual({
      target: { positive: ["pokemon"], negative: ["scam link"] },
      walmart: { positive: ["deal"] },
    });
    expect(result.watch_skus).toEqual({ target: ["95120834", "94860231"] });
  });

  it("preserves watch_skus when target_skus omitted from patch", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      watch_skus: { target: ["95120834"], walmart: ["19965460207"] },
    };
    const result = upsertGlobalWatchSettings(settings, {
      target_positive_keywords: ["pokemon"],
      target_negative_keywords: [],
      walmart_positive_keywords: [],
      walmart_negative_keywords: [],
    });
    expect(result.watch_skus).toEqual({ target: ["95120834"], walmart: ["19965460207"] });
  });

  it("stores normalized walmart_skus", () => {
    const result = upsertGlobalWatchSettings(DEFAULT_SETTINGS, {
      target_positive_keywords: [],
      target_negative_keywords: [],
      walmart_positive_keywords: [],
      walmart_negative_keywords: [],
      walmart_skus: ["19965460207", "19965460207"],
    });
    expect(result.watch_skus).toEqual({ walmart: ["19965460207"] });
  });

  it("preserves target watch_skus when only walmart_skus patched", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      watch_skus: { target: ["95120834"] },
    };
    const result = upsertGlobalWatchSettings(settings, {
      target_positive_keywords: [],
      target_negative_keywords: [],
      walmart_positive_keywords: [],
      walmart_negative_keywords: [],
      walmart_skus: ["19965460207"],
    });
    expect(result.watch_skus).toEqual({ target: ["95120834"], walmart: ["19965460207"] });
  });

  it("omits empty keyword buckets", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      watch_keywords: {
        target: { positive: ["pokemon"], negative: [] },
      },
    };
    const result = upsertGlobalWatchSettings(settings, {
      target_positive_keywords: [],
      target_negative_keywords: [],
      walmart_positive_keywords: [],
      walmart_negative_keywords: [],
    });
    expect(result.watch_keywords).toBeUndefined();
  });
});

describe("getGlobalWatchSkus", () => {
  it("returns configured SKUs for retailer", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      watch_skus: { target: ["95120834"], walmart: ["19965460207"] },
    };
    expect(getGlobalWatchSkus(settings, "target")).toEqual(["95120834"]);
    expect(getGlobalWatchSkus(settings, "walmart")).toEqual(["19965460207"]);
  });
});

describe("stripChannelWatchFields", () => {
  it("removes per-channel watch fields without touching global settings", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      watch_keywords: {
        target: { positive: ["global-kw"], negative: [] },
      },
      watch_skus: { target: ["95120834"] },
      retailer_auto_atc_enabled: true,
      channel_targets: [
        {
          channel_id: "111",
          allowed_domains: ["walmart.com"],
          watch_keywords: {
            target: { positive: ["old"], negative: [] },
          },
          watch_skus: { target: ["11111111"] },
          retailer_auto_atc_enabled: true,
          positive_keywords: ["legacy"],
          negative_keywords: ["legacy-neg"],
        } as (typeof DEFAULT_SETTINGS.channel_targets)[number] & {
          watch_keywords?: unknown;
          watch_skus?: unknown;
          retailer_auto_atc_enabled?: boolean;
          positive_keywords?: string[];
          negative_keywords?: string[];
        },
      ],
    };

    const { settings: stripped, changed } = stripChannelWatchFields(settings);
    expect(changed).toBe(true);
    expect(stripped.channel_targets[0]).toEqual({
      channel_id: "111",
      allowed_domains: ["walmart.com"],
    });
    expect(stripped.watch_keywords).toEqual({
      target: { positive: ["global-kw"], negative: [] },
    });
    expect(stripped.watch_skus).toEqual({ target: ["95120834"] });
    expect(stripped.retailer_auto_atc_enabled).toBe(true);
  });

  it("returns unchanged when no legacy fields exist", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      channel_targets: [buildChannelTarget({ channel_id: "111" })],
    };
    const { changed } = stripChannelWatchFields(settings);
    expect(changed).toBe(false);
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
