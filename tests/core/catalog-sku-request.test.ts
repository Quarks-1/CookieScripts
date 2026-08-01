import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildSkuRequestIssueUrl,
  findSkuInCatalog,
  normalizeSkuForRequest,
} from "@ext/core/lib/catalog/sku-request.ts";
import { parseCatalog } from "@ext/core/lib/catalog/parse.ts";

const CATALOG_PATH = join(process.cwd(), "extension/core/data/catalog.json");

describe("normalizeSkuForRequest", () => {
  it("normalizes Target SKUs", () => {
    expect(normalizeSkuForRequest("target", "95230445")).toBe("95230445");
    expect(normalizeSkuForRequest("target", " 95230445 ")).toBe("95230445");
  });

  it("rejects invalid Target SKUs", () => {
    expect(normalizeSkuForRequest("target", "")).toBeNull();
    expect(normalizeSkuForRequest("target", "abc")).toBeNull();
  });

  it("normalizes Walmart SKUs", () => {
    expect(normalizeSkuForRequest("walmart", "19402160990")).toBe("19402160990");
  });

  it("rejects invalid Walmart SKUs", () => {
    expect(normalizeSkuForRequest("walmart", "12345")).toBeNull();
  });
});

describe("findSkuInCatalog", () => {
  const catalog = parseCatalog(JSON.parse(readFileSync(CATALOG_PATH, "utf8")));
  const known = catalog.products.find((product) =>
    product.listings.some((listing) => listing.retailer === "target"),
  );
  const targetListing = known?.listings.find((listing) => listing.retailer === "target");

  it("returns product name when SKU exists", () => {
    expect(targetListing).toBeDefined();
    expect(known).toBeDefined();
    const hit = findSkuInCatalog(catalog, "target", targetListing!.sku);
    expect(hit).toEqual({ productName: known!.name });
  });

  it("returns null when SKU is missing", () => {
    expect(findSkuInCatalog(catalog, "target", "00000000")).toBeNull();
  });

  it("returns null for invalid SKU input", () => {
    expect(findSkuInCatalog(catalog, "walmart", "123")).toBeNull();
  });
});

describe("buildSkuRequestIssueUrl", () => {
  it("builds a GitHub new-issue URL with encoded title, body, and label", () => {
    const url = buildSkuRequestIssueUrl({
      retailer: "target",
      sku: "95230445",
      extensionVersion: "1.2.3",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://github.com/Quarks-1/CookieScripts/issues/new",
    );
    expect(parsed.searchParams.get("title")).toBe("[catalog-request] target SKU 95230445");
    expect(parsed.searchParams.get("labels")).toBe("catalog-request");
    expect(parsed.searchParams.get("body")).toContain("**Retailer:** target");
    expect(parsed.searchParams.get("body")).toContain("**SKU:** 95230445");
    expect(parsed.searchParams.get("body")).toContain("**Extension version:** 1.2.3");
    expect(parsed.searchParams.get("body")).toContain("<!-- catalog-request-intake -->");
  });

  it("encodes query params without raw spaces", () => {
    const url = buildSkuRequestIssueUrl({
      retailer: "walmart",
      sku: "19402160990",
      extensionVersion: "1.0.0",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/Quarks-1/CookieScripts/issues/new");
    expect(parsed.searchParams.get("title")).toBe("[catalog-request] walmart SKU 19402160990");
    expect(parsed.searchParams.get("labels")).toBe("catalog-request");
    expect(url).not.toContain(" ");
  });
});
