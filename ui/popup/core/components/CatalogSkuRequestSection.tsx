import { useState } from "react";

import { MAX_SKU_LENGTH } from "@ext/core/lib/constants.ts";
import {
  buildSkuRequestIssueUrl,
  findSkuInCatalog,
  normalizeSkuForRequest,
} from "@ext/core/lib/catalog/sku-request.ts";
import { getInstalledVersion } from "@ext/core/lib/version.ts";
import type { CatalogRetailer } from "@ext/core/types/index.ts";
import { SegmentedPillToggle } from "@shared/components/SegmentedPillToggle.tsx";

import { useCatalogForSkuCheck } from "../hooks/useCatalogForSkuCheck.ts";

const RETAILER_OPTIONS = [
  { value: "target" as const, label: "Target" },
  { value: "walmart" as const, label: "Walmart" },
];

type CatalogSkuRequestSectionProps = {
  disabled: boolean;
};

export function CatalogSkuRequestSection({ disabled }: CatalogSkuRequestSectionProps) {
  const [retailer, setRetailer] = useState<CatalogRetailer>("target");
  const [skuDraft, setSkuDraft] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const { loading, load } = useCatalogForSkuCheck();

  function handleSkuBlur() {
    setSkuDraft((current) => current.replace(/\D/g, ""));
  }

  async function handleRequest() {
    setStatusError(null);

    const normalized = normalizeSkuForRequest(retailer, skuDraft);
    if (!normalized) {
      setStatusError("Invalid SKU");
      return;
    }

    const catalog = await load();
    if (!catalog) {
      setStatusError("Could not load catalog");
      return;
    }

    const existing = findSkuInCatalog(catalog, retailer, normalized);
    if (existing) {
      setStatusError(`Already in catalog: ${existing.productName}`);
      return;
    }

    const url = buildSkuRequestIssueUrl({
      retailer,
      sku: normalized,
      extensionVersion: getInstalledVersion(),
    });
    void chrome.tabs.create({ url, active: true });
  }

  const requestDisabled = disabled || loading || skuDraft.trim().length === 0;

  return (
    <section aria-labelledby="global-catalog-sku-request-heading" className="space-y-2">
      <h2 id="global-catalog-sku-request-heading" className="text-sm font-medium text-zinc-400">
        Request catalog SKU
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedPillToggle
          id="global-catalog-sku-request-retailer"
          label="Retailer"
          hideLabel
          value={retailer}
          options={RETAILER_OPTIONS}
          disabled={disabled || loading}
          trackClassName="w-[9rem]"
          onChange={setRetailer}
        />

        <input
          id="global-catalog-sku-request-sku"
          type="text"
          inputMode="numeric"
          maxLength={MAX_SKU_LENGTH}
          value={skuDraft}
          disabled={disabled || loading}
          aria-label="SKU"
          onChange={(event) => setSkuDraft(event.target.value)}
          onBlur={handleSkuBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !requestDisabled) {
              void handleRequest();
            }
          }}
          className="w-24 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
        />

        <button
          type="button"
          disabled={requestDisabled}
          aria-label="Request catalog SKU"
          onClick={() => void handleRequest()}
          className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Request"}
        </button>
      </div>

      {statusError && (
        <p role="status" aria-live="polite" className="text-xs text-red-300">
          {statusError}
        </p>
      )}
    </section>
  );
}
