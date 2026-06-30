import { describe, expect, it } from "vitest";

import {
  cleanWalmartProductTitle,
  disambiguateOpenTabLabels,
  labelWalmartTab,
  truncateLabel,
} from "@ext/domains/walmart/lib/tab-label.ts";

describe("disambiguateOpenTabLabels", () => {
  it("appends tab id when duplicate labels share the same product url", () => {
    const sharedTitle = "Pokémon TCG: Mega Evolution—Ascended Heroes Meg…";
    const url = "https://www.walmart.com/ip/pokemon-tcg/123456789";
    const labels = disambiguateOpenTabLabels([
      { label: sharedTitle, url, tabId: 10 },
      { label: sharedTitle, url, tabId: 20 },
      { label: sharedTitle, url, tabId: 30 },
    ]);
    expect(labels[0]).toMatch(/· T10$/);
    expect(labels[1]).toMatch(/· T20$/);
    expect(labels[2]).toMatch(/· T30$/);
  });

  it("leaves unique labels unchanged", () => {
    const labels = disambiguateOpenTabLabels([
      { label: "Home", url: "https://www.walmart.com/", tabId: 1 },
      { label: "Cart", url: "https://www.walmart.com/cart", tabId: 2 },
    ]);
    expect(labels).toEqual(["Home", "Cart"]);
  });
});

describe("labelWalmartTab", () => {
  it("labels home and browse paths as Home", () => {
    expect(labelWalmartTab("https://www.walmart.com/").label).toBe("Home");
    expect(labelWalmartTab("https://www.walmart.com/browse").label).toBe("Home");
    expect(labelWalmartTab("https://www.walmart.com/browse/electronics").label).toBe("Home");
  });

  it("labels cart, search, queue, pac, and blocked", () => {
    expect(labelWalmartTab("https://www.walmart.com/cart").label).toBe("Cart");
    expect(labelWalmartTab("https://www.walmart.com/search?q=soap").label).toBe("Search");
    expect(labelWalmartTab("https://www.walmart.com/queue/waiting").label).toBe("Queue");
    expect(labelWalmartTab("https://www.walmart.com/pac").label).toBe("PAC");
    expect(labelWalmartTab("https://www.walmart.com/blocked?url=foo").label).toBe("Blocked");
  });

  it("labels checkout steps and post-checkout", () => {
    expect(labelWalmartTab("https://www.walmart.com/checkout/review-order").label).toBe(
      "Checkout · Review",
    );
    expect(labelWalmartTab("https://www.walmart.com/checkout/shipping").label).toBe(
      "Checkout · Shipping",
    );
    expect(labelWalmartTab("https://www.walmart.com/checkout/payment").label).toBe(
      "Checkout · Payment",
    );
    expect(labelWalmartTab("https://www.walmart.com/checkout/place-order").label).toBe(
      "Checkout · Place order",
    );
    expect(labelWalmartTab("https://www.walmart.com/checkout").label).toBe("Checkout");
    expect(labelWalmartTab("https://www.walmart.com/thankyou").label).toBe("Order confirmed");
  });

  it("uses cleaned product title when available", () => {
    const result = labelWalmartTab(
      "https://www.walmart.com/ip/pokemon-scarlet-violet-nintendo-switch/123456",
      "Pokemon Scarlet Violet - Nintendo Switch - Walmart.com",
    );
    expect(result.label).toBe("Pokemon Scarlet Violet - Nintendo Switch");
    expect(result.pageKind).toBe("product");
  });

  it("falls back to humanized slug when title is empty", () => {
    expect(
      labelWalmartTab("https://www.walmart.com/ip/pokemon-scarlet-violet-nintendo-switch/123456").label,
    ).toBe("Pokemon Scarlet Violet Nintendo Switch");
  });

  it("labels other paths from last segment", () => {
    expect(labelWalmartTab("https://www.walmart.com/account/profile").label).toBe("Profile");
  });
});

describe("cleanWalmartProductTitle", () => {
  it("strips common Walmart suffixes", () => {
    expect(cleanWalmartProductTitle("Foo Bar - Walmart.com")).toBe("Foo Bar");
    expect(cleanWalmartProductTitle("Foo Bar | Walmart.com")).toBe("Foo Bar");
    expect(cleanWalmartProductTitle("Foo Bar - Walmart")).toBe("Foo Bar");
  });
});

describe("truncateLabel", () => {
  it("truncates long labels with ellipsis", () => {
    const long = "A".repeat(50);
    expect(truncateLabel(long)).toHaveLength(48);
    expect(truncateLabel(long).endsWith("…")).toBe(true);
  });
});
