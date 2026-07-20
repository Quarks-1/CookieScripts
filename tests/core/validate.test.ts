import { describe, expect, it } from "vitest";

import {
  validateChannelTarget,
  validateGlobalWatchSettings,
  validatePersistedTargets,
} from "@ext/core/lib/validate.ts";
import { DEFAULT_SETTINGS } from "@ext/core/types/index.ts";
import { buildChannelTarget } from "../fixtures/fixtures.ts";

describe("validatePersistedTargets", () => {
  it("accepts empty list", () => {
    expect(validatePersistedTargets([])).toBeNull();
  });

  it("accepts valid targets", () => {
    expect(validatePersistedTargets([buildChannelTarget()])).toBeNull();
  });

  it("rejects non-numeric channel id", () => {
    expect(validatePersistedTargets([buildChannelTarget({ channel_id: "abc" })])).toMatch(
      /numeric/i,
    );
  });

  it("rejects zero channel id", () => {
    expect(validatePersistedTargets([buildChannelTarget({ channel_id: "0" })])).toMatch(
      /positive/i,
    );
  });

  it("rejects duplicate channel ids", () => {
    const target = buildChannelTarget();
    expect(validatePersistedTargets([target, target])).toMatch(/unique/i);
  });

  it("rejects empty domains on stored entry", () => {
    expect(validatePersistedTargets([buildChannelTarget({ allowed_domains: [] })])).toMatch(
      /allowed domain/i,
    );
  });
});

describe("validateChannelTarget", () => {
  it("accepts valid entry", () => {
    expect(validateChannelTarget(buildChannelTarget())).toBeNull();
  });

  it("rejects empty domains", () => {
    expect(validateChannelTarget(buildChannelTarget({ allowed_domains: [] }))).toMatch(
      /allowed domain/i,
    );
  });
});

describe("validateGlobalWatchSettings", () => {
  it("accepts valid global watch settings", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        watch_keywords: {
          target: { positive: ["pokemon"], negative: [] },
        },
        watch_skus: { target: ["95120834"], walmart: ["19965460207"] },
        retailer_auto_atc_enabled: true,
      }),
    ).toBeNull();
  });

  it("rejects keyword longer than max length", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        watch_keywords: {
          target: { positive: ["a".repeat(65)], negative: [] },
        },
      }),
    ).toMatch(/watch_keywords\.target\.positive/i);
  });

  it("rejects overlapping positive and negative keywords per retailer", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        watch_keywords: {
          walmart: { positive: ["scam"], negative: ["scam"] },
        },
      }),
    ).toMatch(/overlap/i);
  });

  it("rejects non-boolean retailer_auto_atc_enabled", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        retailer_auto_atc_enabled: "yes" as unknown as boolean,
      }),
    ).toMatch(/retailer_auto_atc_enabled must be a boolean/i);
  });

  it("rejects invalid retailer_auto_checkout_mode", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        retailer_auto_checkout_mode: "sometimes" as "off",
      }),
    ).toMatch(/retailer_auto_checkout_mode must be off, sku_only, or all/i);
  });

  it("rejects invalid samsclub_checkout_cvv", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        samsclub_checkout_cvv: "12",
      }),
    ).toMatch(/samsclub_checkout_cvv must be exactly 3 digits/i);
  });

  it("accepts valid samsclub_checkout_cvv", () => {
    expect(
      validateGlobalWatchSettings({
        ...DEFAULT_SETTINGS,
        samsclub_checkout_cvv: "123",
      }),
    ).toBeNull();
  });
});
