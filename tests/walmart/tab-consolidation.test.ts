import { describe, expect, it } from "vitest";

import {
  isQpUrl,
  planTabConsolidation,
} from "@ext/domains/walmart/lib/tab-consolidation.ts";

describe("isQpUrl", () => {
  it("matches /qp paths", () => {
    expect(isQpUrl("https://www.walmart.com/qp?qpdata=abc")).toBe(true);
  });
});

describe("planTabConsolidation", () => {
  it("keeps lowest tabId when no homepage", () => {
    const toClose = planTabConsolidation(
      [
        { id: 10, url: "https://www.walmart.com/qp?a=1" },
        { id: 5, url: "https://www.walmart.com/qp?b=2" },
        { id: 12, url: "https://www.walmart.com/qp?c=3" },
      ],
      undefined,
    );
    expect(toClose).toEqual([10, 12]);
  });

  it("closes all qp tabs when homepage exists", () => {
    const toClose = planTabConsolidation(
      [
        { id: 3, url: "https://www.walmart.com/qp?a=1" },
        { id: 7, url: "https://www.walmart.com/" },
      ],
      7,
    );
    expect(toClose).toEqual([3]);
  });

  it("returns empty for single qp tab", () => {
    expect(
      planTabConsolidation([{ id: 1, url: "https://www.walmart.com/qp?a=1" }]),
    ).toEqual([]);
  });
});
