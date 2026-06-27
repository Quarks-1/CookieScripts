import { describe, expect, it } from "vitest";

import { unwrapAffiliateUrl } from "@ext/lib/affiliate-unwrap.ts";

describe("unwrapAffiliateUrl", () => {
  it("unwraps Impact goto vanity links via u param", () => {
    const walmart =
      "https://goto.walmart.com/c/123?u=https%3A%2F%2Fwww.walmart.com%2Fip%2Fitem";
    expect(unwrapAffiliateUrl(walmart)).toBe("https://www.walmart.com/ip/item");

    const target =
      "https://goto.target.com/c/456?u=https%3A%2F%2Fwww.target.com%2Fp%2Fproduct%2F-%2FA-123";
    expect(unwrapAffiliateUrl(target)).toBe("https://www.target.com/p/product/-/A-123");
  });

  it("unwraps Rakuten links via murl param", () => {
    const rakuten =
      "https://click.linksynergy.com/deeplink?id=abc&murl=https%3A%2F%2Fwww.target.com%2Fp%2Fitem";
    expect(unwrapAffiliateUrl(rakuten)).toBe("https://www.target.com/p/item");
  });

  it("leaves non-affiliate urls unchanged", () => {
    const url = "https://www.target.com/p/item";
    expect(unwrapAffiliateUrl(url)).toBe(url);
  });
});
