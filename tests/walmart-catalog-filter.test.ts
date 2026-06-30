import { describe, expect, it } from "vitest";

import { shouldCatalogNetworkEvent } from "@ext/lib/walmart/catalog-filter.ts";
import type { WalmartRecordingEvent } from "@ext/types/walmart.ts";

function networkEvent(
  partial: Partial<Extract<WalmartRecordingEvent, { kind: "network" }>>,
): Extract<WalmartRecordingEvent, { kind: "network" }> {
  return {
    kind: "network",
    ts: "t",
    transport: "fetch",
    method: "GET",
    url: "/x",
    ...partial,
  };
}

describe("catalog-filter", () => {
  it("catalogs orchestra, swag, and px collector traffic", () => {
    expect(
      shouldCatalogNetworkEvent(
        networkEvent({
          absoluteUrl: "https://www.walmart.com/swag/graphql",
        }),
      ),
    ).toBe(true);
    expect(
      shouldCatalogNetworkEvent(
        networkEvent({
          absoluteUrl: "https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector",
        }),
      ),
    ).toBe(true);
    expect(
      shouldCatalogNetworkEvent(
        networkEvent({
          transport: "resource",
          absoluteUrl: "https://www.walmart.com/orchestra/home/graphql/getCart/hash",
        }),
      ),
    ).toBe(false);
  });
});
