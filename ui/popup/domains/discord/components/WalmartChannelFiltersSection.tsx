import { KeywordPills } from "@shared/components/KeywordPills.tsx";

interface WalmartChannelFiltersSectionProps {
  channelId: string | null;
  positiveKeywords: string[];
  negativeKeywords: string[];
  hasAllowedDomains: boolean;
  disabled?: boolean;
  saving?: boolean;
  onPositiveKeywordsChange: (keywords: string[]) => void;
  onNegativeKeywordsChange: (keywords: string[]) => void;
}

export function WalmartChannelFiltersSection({
  channelId,
  positiveKeywords,
  negativeKeywords,
  hasAllowedDomains,
  disabled,
  saving,
  onPositiveKeywordsChange,
  onNegativeKeywordsChange,
}: WalmartChannelFiltersSectionProps) {
  if (channelId === null) {
    return null;
  }

  const listDisabled = disabled || saving;
  const keywordInputDisabled = listDisabled || !hasAllowedDomains;

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
          <h3 className="text-xs text-zinc-500">Positive keywords</h3>
          <div className="mt-0.5">
            <KeywordPills
              key={`${channelId}-walmart-positive`}
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
          <h3 className="text-xs text-zinc-500">Negative keywords</h3>
          <div className="mt-0.5">
            <KeywordPills
              key={`${channelId}-walmart-negative`}
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
      </div>
    </section>
  );
}
