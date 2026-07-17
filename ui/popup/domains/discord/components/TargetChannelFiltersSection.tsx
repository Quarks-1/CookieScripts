import { KeywordPills } from "@shared/components/KeywordPills.tsx";
import { SkuPills } from "@shared/components/SkuPills.tsx";

interface TargetChannelFiltersSectionProps {
  positiveKeywords: string[];
  negativeKeywords: string[];
  targetSkus: string[];
  skuModeActive?: boolean;
  disabled?: boolean;
  saving?: boolean;
  onPositiveKeywordsChange: (keywords: string[]) => void;
  onNegativeKeywordsChange: (keywords: string[]) => void;
  onTargetSkusChange: (skus: string[]) => void;
}

export function TargetChannelFiltersSection({
  positiveKeywords,
  negativeKeywords,
  targetSkus,
  skuModeActive,
  disabled,
  saving,
  onPositiveKeywordsChange,
  onNegativeKeywordsChange,
  onTargetSkusChange,
}: TargetChannelFiltersSectionProps) {
  const listDisabled = disabled || saving;
  const keywordInputDisabled = listDisabled || skuModeActive === true;

  return (
    <section
      aria-labelledby="target-channel-filters-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5"
    >
      <h2 id="target-channel-filters-heading" className="text-sm font-medium text-zinc-400">
        Target
      </h2>

      <div className="mt-2 space-y-2">
        <div>
          <h3 className="text-xs text-zinc-500">Positive keywords</h3>
          <div className="mt-0.5">
            <KeywordPills
              keywords={positiveKeywords}
              onChange={onPositiveKeywordsChange}
              variant="positive"
              disabled={listDisabled}
              inputDisabled={keywordInputDisabled}
              inputId="popup-target-positive-keyword-input"
              addAriaLabel="Add Target positive keyword"
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs text-zinc-500">Negative keywords</h3>
          <div className="mt-0.5">
            <KeywordPills
              keywords={negativeKeywords}
              onChange={onNegativeKeywordsChange}
              variant="negative"
              disabled={listDisabled}
              inputDisabled={keywordInputDisabled}
              inputId="popup-target-negative-keyword-input"
              addAriaLabel="Add Target negative keyword"
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs text-zinc-500">SKUs</h3>
          <div className="mt-0.5">
            <SkuPills
              skus={targetSkus}
              onChange={onTargetSkusChange}
              disabled={listDisabled}
              inputDisabled={listDisabled}
              inputId="popup-target-sku-input"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
