declare module "@catalog-liveness/classify-target.mjs" {
  export function classifyTargetHtml(html: string): {
    status: string;
    title: string | null;
    marketplace: boolean;
    note?: string;
  };
  export const TARGET_CONTROLS: readonly string[];
  export function isBlockedByControls(
    controlResults: Array<{ status: string }>,
  ): boolean;
}

declare module "@catalog-liveness/classify-walmart.mjs" {
  export const STOP_WORDS: Set<string>;
  export function tokenize(name: string): Set<string>;
  export function slugSimilarity(ourName: string, seoUrl: string): number;
  export function parseWalmartProbeResponse(res: Response): {
    validHeader: string | null;
    seoUrl: string | null;
  };
  export function classifyWalmartProbe(params: {
    validHeader: string | null;
    seoUrl: string | null;
    ourName: string;
  }): {
    status: string;
    identity_mismatch: boolean;
    similarity: number;
    walmart_slug: string | null;
  };
}

declare module "@catalog-liveness/prune-policy.mjs" {
  export function isPrunableListing(
    listing: { retailer: string; status: string; identity_mismatch?: boolean },
    options?: { dropMarketplace?: boolean },
  ): boolean;
  export function computePrunePlan(
    catalog: {
      products: Array<{
        id: string;
        name: string;
        listings: Array<{ retailer: string; sku: string }>;
      }>;
    },
    report: object,
    options?: { dropMarketplace?: boolean },
  ): {
    removed_listings: Array<{
      retailer: string;
      sku: string;
      product_id: string;
      product_name: string;
      status: string;
    }>;
    removed_products: Array<{ id: string; name: string }>;
    prunedCatalog: typeof catalog;
    changes: boolean;
  };
}
