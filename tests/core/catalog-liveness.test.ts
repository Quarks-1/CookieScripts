import { describe, expect, it } from "vitest";

import {
  classifyTargetHtml,
  isBlockedByControls,
} from "@catalog-liveness/classify-target.mjs";
import {
  classifyWalmartProbe,
  slugSimilarity,
} from "@catalog-liveness/classify-walmart.mjs";
import { computePrunePlan } from "@catalog-liveness/prune-policy.mjs";

describe("catalog-liveness", () => {
  describe("classifyTargetHtml", () => {
    it("classifies dead PDP without og:title", () => {
      const html = '<html><body>Currently unavailable</body></html>';
      expect(classifyTargetHtml(html)).toEqual({
        status: "dead",
        title: null,
        marketplace: false,
      });
    });

    it("classifies live first-party PDP", () => {
      const html =
        '<meta property="og:title" content="Pokemon ETB" /><body>In stock</body>';
      expect(classifyTargetHtml(html)).toEqual({
        status: "live",
        title: "Pokemon ETB",
        marketplace: false,
      });
    });

    it("classifies live marketplace PDP", () => {
      const html =
        '<meta property="og:title" content="Pokemon ETB" /><body>Sold and shipped by Acme</body>';
      expect(classifyTargetHtml(html)).toEqual({
        status: "live_marketplace",
        title: "Pokemon ETB",
        marketplace: true,
      });
    });

    it("classifies unclear when signals conflict", () => {
      const html =
        '<meta property="og:title" content="Pokemon ETB" /><body>Currently unavailable</body>';
      const result = classifyTargetHtml(html);
      expect(result.status).toBe("unclear");
      expect(result.note).toContain("unavailable=true");
    });
  });

  describe("isBlockedByControls", () => {
    it("returns true when any control is dead", () => {
      expect(
        isBlockedByControls([
          { status: "live" },
          { status: "dead" },
        ]),
      ).toBe(true);
    });

    it("returns false when all controls are live", () => {
      expect(
        isBlockedByControls([
          { status: "live" },
          { status: "live_marketplace" },
        ]),
      ).toBe(false);
    });
  });

  describe("classifyWalmartProbe", () => {
    it("classifies valid header", () => {
      const result = classifyWalmartProbe({
        validHeader: "true",
        seoUrl: "/ip/scarlet-violet-elite-trainer-box/12345",
        ourName: "Scarlet Violet Elite Trainer Box",
      });
      expect(result.status).toBe("valid");
      expect(result.identity_mismatch).toBe(false);
      expect(result.similarity).toBeGreaterThan(0.3);
    });

    it("classifies invalid header", () => {
      const result = classifyWalmartProbe({
        validHeader: "false",
        seoUrl: null,
        ourName: "Some Product",
      });
      expect(result).toEqual({
        status: "invalid",
        identity_mismatch: false,
        similarity: 0,
        walmart_slug: null,
      });
    });

    it("classifies unclear header", () => {
      const result = classifyWalmartProbe({
        validHeader: null,
        seoUrl: null,
        ourName: "Some Product",
      });
      expect(result.status).toBe("unclear");
      expect(result.identity_mismatch).toBe(false);
    });

    it("flags identity mismatch below threshold", () => {
      const result = classifyWalmartProbe({
        validHeader: "true",
        seoUrl: "/ip/totally-unrelated-widget/99999",
        ourName: "Perfect Order Elite Trainer Box",
      });
      expect(result.status).toBe("valid");
      expect(result.identity_mismatch).toBe(true);
      expect(result.similarity).toBeLessThan(0.34);
    });
  });

  describe("slugSimilarity", () => {
    it("returns 0 for empty token sets", () => {
      expect(slugSimilarity("a", "/ip/x/1")).toBe(0);
    });
  });

  describe("computePrunePlan", () => {
    const baseCatalog = {
      schema_version: 1,
      product_types: ["booster_box"],
      sets: [],
      products: [
        {
          id: "dead-product",
          name: "Dead Product",
          type: "booster_box",
          msrp_cents: 1000,
          contents: [],
          listings: [
            { retailer: "target", sku: "111" },
            { retailer: "walmart", sku: "222" },
          ],
        },
        {
          id: "live-product",
          name: "Live Product",
          type: "booster_box",
          msrp_cents: 1000,
          contents: [],
          listings: [{ retailer: "target", sku: "333" }],
        },
        {
          id: "mismatch-product",
          name: "Mismatch Product",
          type: "booster_box",
          msrp_cents: 1000,
          contents: [],
          listings: [{ retailer: "walmart", sku: "444" }],
        },
        {
          id: "marketplace-product",
          name: "Marketplace Product",
          type: "booster_box",
          msrp_cents: 1000,
          contents: [],
          listings: [{ retailer: "target", sku: "555" }],
        },
      ],
    };

    const report = {
      blocked: false,
      target: {
        listings: [
          { sku: "111", status: "dead" },
          { sku: "333", status: "live" },
          { sku: "555", status: "live_marketplace" },
        ],
      },
      walmart: {
        listings: [
          { sku: "222", status: "invalid" },
          { sku: "444", status: "valid", identity_mismatch: true },
        ],
      },
    };

    it("prunes dead target listings when present in report", () => {
      const plan = computePrunePlan(baseCatalog, report);
      expect(plan.removed_listings).toHaveLength(2);
      expect(plan.removed_listings.map((l) => l.sku).sort()).toEqual(["111", "222"]);
      expect(plan.removed_products).toEqual([{ id: "dead-product", name: "Dead Product" }]);
      expect(plan.prunedCatalog.products).toHaveLength(3);
    });

    it("does not prune walmart when walmart is omitted from report", () => {
      const targetOnlyReport = {
        blocked: false,
        target: report.target,
        walmart: { listings: [] },
      };
      const plan = computePrunePlan(baseCatalog, targetOnlyReport);
      expect(plan.removed_listings).toEqual([
        expect.objectContaining({ retailer: "target", sku: "111", status: "dead" }),
      ]);
      const deadProduct = plan.prunedCatalog.products.find((p) => p.id === "dead-product");
      expect(deadProduct?.listings).toEqual([{ retailer: "walmart", sku: "222" }]);
    });

    it("keeps unclear, identity_mismatch, and marketplace by default", () => {
      const plan = computePrunePlan(baseCatalog, report);
      const skus = plan.prunedCatalog.products.flatMap((p) =>
        p.listings.map((l) => l.sku),
      );
      expect(skus).toContain("333");
      expect(skus).toContain("444");
      expect(skus).toContain("555");
    });

    it("prunes marketplace with dropMarketplace", () => {
      const plan = computePrunePlan(baseCatalog, report, { dropMarketplace: true });
      const removed = plan.removed_listings.map((l) => l.sku);
      expect(removed).toContain("555");
    });

    it("keeps listings missing from report", () => {
      const catalog = {
        ...baseCatalog,
        products: [
          {
            id: "unreported",
            name: "Unreported",
            type: "booster_box",
            msrp_cents: 1000,
            contents: [],
            listings: [{ retailer: "target", sku: "999" }],
          },
        ],
      };
      const plan = computePrunePlan(catalog, { blocked: false, target: { listings: [] }, walmart: { listings: [] } });
      expect(plan.removed_listings).toHaveLength(0);
      expect(plan.prunedCatalog.products[0].listings).toHaveLength(1);
    });

    it("does not mutate catalog when report is blocked", () => {
      const blockedReport = { ...report, blocked: true };
      const plan = computePrunePlan(baseCatalog, blockedReport);
      expect(plan.changes).toBe(false);
      expect(plan.removed_listings).toHaveLength(0);
      expect(plan.removed_products).toHaveLength(0);
      expect(plan.prunedCatalog).toBe(baseCatalog);
    });
  });
});
