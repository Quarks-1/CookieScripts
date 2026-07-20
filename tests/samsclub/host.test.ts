import { describe, expect, it } from "vitest";

import {
  isSamsclubProductUrl,
  isSamsclubUrl,
} from "@ext/domains/samsclub/lib/host.ts";

describe("samsclub host", () => {
  it("detects samsclub URLs", () => {
    expect(isSamsclubUrl("https://www.samsclub.com/ip/Rattle/20186272756")).toBe(true);
    expect(isSamsclubUrl("https://samsclub.com/cart")).toBe(true);
    expect(isSamsclubUrl("https://www.target.com/p/foo")).toBe(false);
  });

  it("detects product PDP URLs", () => {
    expect(isSamsclubProductUrl("https://www.samsclub.com/ip/Rattle/20186272756")).toBe(
      true,
    );
    expect(isSamsclubProductUrl("https://www.samsclub.com/cart")).toBe(false);
  });
});
