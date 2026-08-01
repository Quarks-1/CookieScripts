import { GITHUB_OWNER, GITHUB_REPO } from "@ext/core/lib/constants.ts";
import { normalizeTargetSku } from "@ext/domains/target/lib/index.ts";
import { normalizeWalmartSku } from "@ext/domains/walmart/lib/index.ts";
import type { CatalogData, CatalogRetailer } from "@ext/core/types/index.ts";

const CATALOG_REQUEST_INTAKE_MARKER = "<!-- catalog-request-intake -->";
const CATALOG_REQUEST_LABEL = "catalog-request";

export function normalizeSkuForRequest(
  retailer: CatalogRetailer,
  raw: string,
): string | null {
  return retailer === "target" ? normalizeTargetSku(raw) : normalizeWalmartSku(raw);
}

export function findSkuInCatalog(
  catalog: CatalogData,
  retailer: CatalogRetailer,
  rawSku: string,
): { productName: string } | null {
  const normalized = normalizeSkuForRequest(retailer, rawSku);
  if (!normalized) {
    return null;
  }

  for (const product of catalog.products) {
    for (const listing of product.listings) {
      if (listing.retailer === retailer && listing.sku === normalized) {
        return { productName: product.name };
      }
    }
  }

  return null;
}

function buildSkuRequestIssueBody(
  retailer: CatalogRetailer,
  sku: string,
  extensionVersion: string,
): string {
  return [
    "## SKU request",
    "",
    `- **Retailer:** ${retailer}`,
    `- **SKU:** ${sku}`,
    `- **Extension version:** ${extensionVersion}`,
    "",
    CATALOG_REQUEST_INTAKE_MARKER,
  ].join("\n");
}

export function buildSkuRequestIssueUrl(options: {
  retailer: CatalogRetailer;
  sku: string;
  extensionVersion: string;
}): string {
  const { retailer, sku, extensionVersion } = options;
  const title = `[catalog-request] ${retailer} SKU ${sku}`;
  const body = buildSkuRequestIssueBody(retailer, sku, extensionVersion);
  const params = new URLSearchParams({
    title,
    body,
    labels: CATALOG_REQUEST_LABEL,
  });

  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new?${params.toString()}`;
}
