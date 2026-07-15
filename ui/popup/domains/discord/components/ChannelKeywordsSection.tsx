import { KeywordPills } from "@shared/components/KeywordPills.tsx";

interface ChannelKeywordsSectionProps {
  channelId: string | null;
  positiveKeywords: string[];
  negativeKeywords: string[];
  disabled?: boolean;
  skuModeActive?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onPositiveKeywordsChange: (keywords: string[]) => void;
  onNegativeKeywordsChange: (keywords: string[]) => void;
}

export function ChannelKeywordsSection({
  channelId,
  positiveKeywords,
  negativeKeywords,
  disabled,
  skuModeActive,
  saving,
  saveError,
  onPositiveKeywordsChange,
  onNegativeKeywordsChange,
}: ChannelKeywordsSectionProps) {
  if (channelId === null) {
    return (
      <section
        aria-labelledby="keywords-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
      >
        <h2 id="keywords-heading" className="text-sm font-medium text-zinc-400">
          Link keywords
        </h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="keywords-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
    >
      <h2 id="keywords-heading" className="text-sm font-medium text-zinc-400">
        Link keywords
      </h2>

      <div className="mt-3 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Positive keywords</h3>
          <div className="mt-2">
            <KeywordPills
              keywords={positiveKeywords}
              onChange={onPositiveKeywordsChange}
              variant="positive"
              disabled={disabled || saving}
              inputDisabled={disabled || saving || skuModeActive}
              inputId="popup-positive-keyword-input"
              placeholder="Type a keyword and press Enter"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-300">Negative keywords</h3>
          <div className="mt-2">
            <KeywordPills
              keywords={negativeKeywords}
              onChange={onNegativeKeywordsChange}
              variant="negative"
              disabled={disabled || saving}
              inputDisabled={disabled || saving || skuModeActive}
              inputId="popup-negative-keyword-input"
              placeholder="Type a keyword and press Enter"
            />
          </div>
        </div>
      </div>

      {saving && <p className="mt-2 text-xs text-zinc-500">Saving…</p>}
      {saveError && (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-red-300">
          {saveError}
        </p>
      )}
    </section>
  );
}
