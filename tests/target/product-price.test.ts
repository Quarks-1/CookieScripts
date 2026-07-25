/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  parsePriceTextToCents,
  readProductPriceCentsForAutomation,
  readProductPriceCentsFromDom,
  readProductPriceCentsFromNextData,
  readProductPriceCentsFromNextDataText,
} from "@ext/domains/target/lib/product-price.ts";

const NEXT_DATA_FIXTURE = {
  props: {
    pageProps: {
      product: {
        tcin: "95298174",
        price: {
          current_retail: 4999,
          formatted_current_price: "$49.99",
        },
      },
    },
  },
};

function installNextDataFixture(fixture: object = NEXT_DATA_FIXTURE): void {
  const script = document.createElement("script");
  script.id = "__NEXT_DATA__";
  script.textContent = JSON.stringify(fixture);
  document.head.appendChild(script);
}

describe("product-price", () => {
  it("parses dollar text to cents", () => {
    expect(parsePriceTextToCents("$49.99")).toBe(4999);
    expect(parsePriceTextToCents("Now $44.99")).toBe(4499);
  });

  it("reads current_retail from __NEXT_DATA__", () => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    installNextDataFixture();
    expect(
      readProductPriceCentsFromNextData(
        document,
        "https://www.target.com/p/foo/-/A-95298174",
      ),
    ).toBe(4999);
  });

  it("falls back to formatted_current_price in __NEXT_DATA__ text", () => {
    expect(
      readProductPriceCentsFromNextDataText(
        '{"price":{"formatted_current_price":"$54.99"}}',
      ),
    ).toBe(5499);
  });

  it("returns null when __NEXT_DATA__ tcin does not match page URL", () => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    installNextDataFixture();
    expect(
      readProductPriceCentsFromNextData(
        document,
        "https://www.target.com/p/other/-/A-99999999",
      ),
    ).toBeNull();
  });

  it("reads price from DOM fallback", () => {
    document.body.innerHTML = '<div data-test="product-price">$49.99</div>';
    document.head.innerHTML = "";
    expect(readProductPriceCentsFromDom(document)).toBe(4999);
  });

  it("prefers __NEXT_DATA__ over DOM", () => {
    document.body.innerHTML = '<div data-test="product-price">$99.99</div>';
    document.head.innerHTML = "";
    installNextDataFixture();
    expect(
      readProductPriceCentsForAutomation(
        document,
        "https://www.target.com/p/foo/-/A-95298174",
      ),
    ).toBe(4999);
  });
});
