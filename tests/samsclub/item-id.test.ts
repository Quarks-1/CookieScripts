import { describe, expect, it } from "vitest";

import { parseSamsclubItemIdFromUrl } from "@ext/domains/samsclub/lib/main-add-to-cart.ts";

describe("parseSamsclubItemIdFromUrl", () => {
  it("parses numeric item id from PDP path", () => {
    expect(
      parseSamsclubItemIdFromUrl("https://www.samsclub.com/ip/Rattle/20186272756"),
    ).toBe("20186272756");
  });

  it("returns null for non-product URLs", () => {
    expect(parseSamsclubItemIdFromUrl("https://www.samsclub.com/cart")).toBeNull();
  });
});
