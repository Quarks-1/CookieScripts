import { describe, expect, it } from "vitest";

import { isThrottlePage } from "@ext/domains/walmart/lib/throttle-page.ts";

describe("isThrottlePage", () => {
  it("detects hold tight high traffic copy", () => {
    expect(
      isThrottlePage({
        bodyText: "Hold tight for a moment\nHigh traffic is slowing things down a bit.",
        pathname: "/ip/foo/123",
      }),
    ).toBe(true);
  });

  it("excludes almost gone queue wait", () => {
    expect(
      isThrottlePage({
        bodyText: "This deal is almost gone. Hang tight- we'll notify you when it's your turn",
        pathname: "/qp",
      }),
    ).toBe(false);
  });

  it("excludes checkout paths", () => {
    expect(
      isThrottlePage({
        bodyText: "Hold tight high traffic",
        pathname: "/checkout/review-order",
      }),
    ).toBe(false);
  });

  it("detects loading shell after delay on qp", () => {
    expect(
      isThrottlePage({
        bodyText: "",
        pathname: "/qp",
        mainContentText: "Loading…",
        loadingSinceMs: 6_000,
      }),
    ).toBe(true);
  });
});
