import { MAX_KEYWORDS_PER_LIST } from "@ext/core/lib/constants.ts";
import { normalizeKeyword } from "@ext/core/lib/keywords.ts";

import { CollapsiblePillList } from "./CollapsiblePillList.tsx";

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
  addAriaLabel?: string;
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
  placeholder = "Add keyword",
  addAriaLabel,
}: KeywordPillsProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <CollapsiblePillList
      items={keywords}
      onChange={onChange}
      normalize={normalizeKeyword}
      blurBehavior="clear"
      maxItems={MAX_KEYWORDS_PER_LIST}
      pillClassName={styles.pill}
      removeButtonClassName={styles.button}
      placeholder={placeholder}
      addAriaLabel={addAriaLabel ?? "Add keyword"}
      inputId={inputId}
      disabled={disabled}
      inputDisabled={inputDisabled}
    />
  );
}
