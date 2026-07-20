import { describe, expect, it } from "vitest";

import {
  buildUpdateItemsBody,
  parseCartApiProbeResponse,
  SAMSCLUB_UPDATE_ITEMS_URL,
} from "@ext/domains/samsclub/lib/cart-api.ts";

describe("samsclub cart-api", () => {
  it("builds updateItems graphql body", () => {
    const body = JSON.parse(
      buildUpdateItemsBody({
        usItemId: "18638953319",
        offerId: "6EA7B9AB6C4B302E84F6FB387E5B7507",
        cartId: "ca-abc",
        quantity: 1,
      }),
    );
    expect(body.variables.input.cartId).toBe("ca-abc");
    expect(body.variables.input.items[0]).toMatchObject({
      usItemId: "18638953319",
      offerId: "6EA7B9AB6C4B302E84F6FB387E5B7507",
      quantity: 1,
    });
  });

  it("uses orchestra updateItems endpoint", () => {
    expect(SAMSCLUB_UPDATE_ITEMS_URL).toContain("/orchestra/cartxo/graphql/updateItems/");
  });

  it("parses graphql success as added", () => {
    expect(parseCartApiProbeResponse(200, { data: { updateItems: {} } })).toEqual({
      kind: "added",
    });
  });

  it("parses inventory graphql errors as out_of_stock", () => {
    expect(
      parseCartApiProbeResponse(200, {
        errors: [{ message: "Item is out of stock" }],
      }),
    ).toEqual({ kind: "out_of_stock" });
  });
});
