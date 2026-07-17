import { KeywordPills } from "@shared/components/KeywordPills.tsx";
import { PillListSectionHeader } from "@shared/components/PillListSectionHeader.tsx";
import { SkuPills } from "@shared/components/SkuPills.tsx";
import { normalizeWalmartSku } from "@ext/domains/walmart/lib/index.ts";

interface WalmartChannelFiltersSectionProps {
  positiveKeywords: string[];
  negativeKeywords: string[];
  walmartSkus: string[];
  skuModeActive?: boolean;
  disabled?: boolean;
  saving?: boolean;
  onPositiveKeywordsChange: (keywords: string[]) => void;
  onNegativeKeywordsChange: (keywords: string[]) => void;
  onWalmartSkusChange: (skus: string[]) => void;
}

export function WalmartChannelFiltersSection({
  positiveKeywords,
  negativeKeywords,
  walmartSkus,
  skuModeActive,
  disabled,
  saving,
  onPositiveKeywordsChange,
  onNegativeKeywordsChange,
  onWalmartSkusChange,
}: WalmartChannelFiltersSectionProps) {
  const listDisabled = disabled || saving;
  const keywordInputDisabled = listDisabled || skuModeActive === true;

  return (
    <section
      aria-labelledby="walmart-channel-filters-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5"
    >
      <h2 id="walmart-channel-filters-heading" className="text-sm font-medium text-zinc-400">
        Walmart
      </h2>

      <div className="mt-2 space-y-2">
        <div>
          <PillListSectionHeader
            title="Positive keywords"
            itemCount={positiveKeywords.length}
            disabled={listDisabled}
            onClear={() => onPositiveKeywordsChange([])}
            clearAriaLabel="Clear all Walmart positive keywords"
          />
          <div className="mt-0.5">
            <KeywordPills
              keywords={positiveKeywords}
              onChange={onPositiveKeywordsChange}
              variant="positive"
              disabled={listDisabled}
              inputDisabled={keywordInputDisabled}
              inputId="popup-walmart-positive-keyword-input"
              addAriaLabel="Add Walmart positive keyword"
            />
          </div>
        </div>

        <div>
          <PillListSectionHeader
            title="Negative keywords"
            itemCount={negativeKeywords.length}
            disabled={listDisabled}
            onClear={() => onNegativeKeywordsChange([])}
            clearAriaLabel="Clear all Walmart negative keywords"
          />
          <div className="mt-0.5">
            <KeywordPills
              keywords={negativeKeywords}
              onChange={onNegativeKeywordsChange}
              variant="negative"
              disabled={listDisabled}
              inputDisabled={keywordInputDisabled}
              inputId="popup-walmart-negative-keyword-input"
              addAriaLabel="Add Walmart negative keyword"
            />
          </div>
        </div>

        <div>
          <PillListSectionHeader
            title="SKUs"
            itemCount={walmartSkus.length}
            disabled={listDisabled}
            onClear={() => onWalmartSkusChange([])}
            clearAriaLabel="Clear all Walmart SKUs"
          />
          <div className="mt-0.5">
            <SkuPills
              skus={walmartSkus}
              onChange={onWalmartSkusChange}
              normalizeSku={normalizeWalmartSku}
              disabled={listDisabled}
              inputDisabled={listDisabled}
              inputId="popup-walmart-sku-input"
              addAriaLabel="Add Walmart SKU"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
