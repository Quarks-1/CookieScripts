import { describe, expect, it } from "vitest";

import {
  classifyRetailerPageKind,
  disambiguateOpenTabLabels,
  labelRetailerTab,
} from "@ext/domains/target/lib/tab-label.ts";

describe("classifyRetailerPageKind", () => {
  it("classifies common Target surfaces", () => {
    expect(classifyRetailerPageKind("https://www.target.com/")).toBe("home");
    expect(classifyRetailerPageKind("https://www.target.com/cart")).toBe("cart");
    expect(classifyRetailerPageKind("https://www.target.com/checkout/start")).toBe("checkout");
    expect(
      classifyRetailerPageKind("https://www.target.com/order-confirmation/123"),
    ).toBe("order_confirmation");
    expect(classifyRetailerPageKind("https://www.target.com/p/foo/-/A-12345678")).toBe(
      "product",
    );
  });
});

describe("labelRetailerTab", () => {
  it("labels home, cart, checkout, and product pages", () => {
    expect(labelRetailerTab("https://www.target.com/", "Target")).toEqual({
      label: "Home",
      pageKind: "home",
    });
    expect(labelRetailerTab("https://www.target.com/cart", "Cart : Target")).toEqual({
      label: "Cart",
      pageKind: "cart",
    });
    expect(
      labelRetailerTab("https://www.target.com/checkout/start", "Checkout : Target"),
    ).toEqual({
      label: "Checkout",
      pageKind: "checkout",
    });
    expect(
      labelRetailerTab(
        "https://www.target.com/p/pokemon-tcg/-/A-12345678",
        "Pokémon TCG : Target",
      ),
    ).toEqual({
      label: "Pokémon TCG",
      pageKind: "product",
    });
    expect(
      labelRetailerTab(
        "https://www.target.com/p/mega-evolutions/-/A-12345678",
        "Pokémon Trading Card Game: Mega Evolutions Booster Bundle : Target",
      ),
    ).toEqual({
      label: "Mega Evolutions Booster Bundle",
      pageKind: "product",
    });
  });
});

describe("disambiguateOpenTabLabels", () => {
  it("suffixes duplicate product labels with TCIN when unique", () => {
    const tabs = [
      {
        tabId: 1,
        label: "Pokémon TCG",
        url: "https://www.target.com/p/pokemon-tcg/-/A-111",
      },
      {
        tabId: 2,
        label: "Pokémon TCG",
        url: "https://www.target.com/p/pokemon-tcg/-/A-222",
      },
    ];
    expect(disambiguateOpenTabLabels(tabs)).toEqual([
      "Pokémon TCG · T111",
      "Pokémon TCG · T222",
    ]);
  });
});
