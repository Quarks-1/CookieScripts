import { describe, expect, it } from "vitest";

import { isThrottlePage } from "@ext/domains/samsclub/lib/throttle-page.ts";

describe("samsclub isThrottlePage", () => {
  it("detects hold tight for a moment copy", () => {
    expect(
      isThrottlePage({
        bodyText: "Hold tight for a moment\nPlease wait - SamsClub.com",
        pathname: "/cart",
      }),
    ).toBe(true);
  });

  it("detects hold tight high traffic copy", () => {
    expect(
      isThrottlePage({
        bodyText: "Hold tight\nHigh traffic is slowing things down a bit.",
        pathname: "/ip/foo/123",
      }),
    ).toBe(true);
  });

  it("excludes queue wait copy", () => {
    expect(
      isThrottlePage({
        bodyText: "You're in line. Hold my spot while we process your request.",
        pathname: "/cart",
      }),
    ).toBe(false);
  });

  it("excludes blocked paths", () => {
    expect(
      isThrottlePage({
        bodyText: "Hold tight for a moment",
        pathname: "/blocked",
      }),
    ).toBe(false);
  });
});
