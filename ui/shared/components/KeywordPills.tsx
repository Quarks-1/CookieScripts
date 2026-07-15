import { useState, type KeyboardEvent } from "react";

import { MAX_KEYWORDS_PER_LIST } from "@ext/core/lib/constants.ts";
import { normalizeKeyword } from "@ext/core/lib/keywords.ts";

type KeywordPillsVariant = "positive" | "negative";

interface KeywordPillsProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  variant: KeywordPillsVariant;
  disabled?: boolean;
  /** When set, disables only the add-keyword input (remove buttons still follow `disabled`). */
  inputDisabled?: boolean;
  inputId?: string;
  placeholder?: string;
}

const VARIANT_STYLES: Record<
  KeywordPillsVariant,
  { pill: string; button: string }
> = {
  positive: {
    pill: "border-emerald-700 bg-emerald-950/80 text-emerald-200",
    button: "text-emerald-400 hover:bg-emerald-900/60 hover:text-emerald-100",
  },
  negative: {
    pill: "border-rose-700 bg-rose-950/80 text-rose-200",
    button: "text-rose-400 hover:bg-rose-900/60 hover:text-rose-100",
  },
};

export function KeywordPills({
  keywords,
  onChange,
  variant,
  disabled,
  inputDisabled,
  inputId,
  placeholder = "Type a keyword and press Enter",
}: KeywordPillsProps) {
  const [draft, setDraft] = useState("");
  const styles = VARIANT_STYLES[variant];
  const addDisabled = inputDisabled ?? disabled;

  function addDraft() {
    const keyword = normalizeKeyword(draft);
    setDraft("");
    if (!keyword) {
      return;
    }
    if (keywords.length >= MAX_KEYWORDS_PER_LIST) {
      return;
    }
    if (keywords.includes(keyword)) {
      return;
    }
    onChange([...keywords, keyword]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  }

  function removeKeyword(keyword: string) {
    onChange(keywords.filter((entry) => entry !== keyword));
  }

  return (
    <div className="space-y-3">
      {keywords.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <li key={keyword}>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm font-medium ${styles.pill}`}
              >
                {keyword}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeKeyword(keyword)}
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50 ${styles.button}`}
                  aria-label={`Remove ${keyword}`}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No keywords yet.</p>
      )}

      <input
        id={inputId}
        type="text"
        value={draft}
        disabled={addDisabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            setDraft("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="done"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 invalid:user-invalid:border-red-600 disabled:opacity-50"
      />
    </div>
  );
}
