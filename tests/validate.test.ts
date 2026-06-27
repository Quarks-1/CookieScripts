import { describe, expect, it } from "vitest";

import { buildChannelTarget } from "./fixtures.ts";
import { validateChannelTargets } from "@ext/lib/validate.ts";

describe("validateChannelTargets", () => {
  it("accepts valid targets", () => {
    expect(validateChannelTargets([buildChannelTarget()])).toBeNull();
  });

  it("rejects empty list", () => {
    expect(validateChannelTargets([])).toMatch(/at least one channel/i);
  });

  it("rejects non-numeric channel id", () => {
    expect(validateChannelTargets([buildChannelTarget({ channel_id: "abc" })])).toMatch(/numeric/i);
  });

  it("rejects zero channel id", () => {
    expect(validateChannelTargets([buildChannelTarget({ channel_id: "0" })])).toMatch(/positive/i);
  });

  it("rejects duplicate channel ids", () => {
    const target = buildChannelTarget();
    expect(validateChannelTargets([target, target])).toMatch(/unique/i);
  });

  it("rejects empty domains", () => {
    expect(validateChannelTargets([buildChannelTarget({ allowed_domains: [] })])).toMatch(
      /enabled domain/i,
    );
  });
});
