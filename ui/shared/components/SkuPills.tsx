import { MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import { normalizeTargetSku } from "@ext/domains/target/lib/index.ts";

import { CollapsiblePillList } from "./CollapsiblePillList.tsx";

interface SkuPillsProps {
  skus: string[];
  onChange: (skus: string[]) => void;
  disabled?: boolean;
  inputDisabled?: boolean;
  inputId?: string;
  placeholder?: string;
  addAriaLabel?: string;
}

export function SkuPills({
  skus,
  onChange,
  disabled,
  inputDisabled,
  inputId,
  placeholder = "Add SKU",
  addAriaLabel = "Add SKU",
}: SkuPillsProps) {
  return (
    <CollapsiblePillList
      items={skus}
      onChange={onChange}
      normalize={normalizeTargetSku}
      blurBehavior="clear"
      maxItems={MAX_SKUS_PER_LIST}
      pillClassName="border-sky-700 bg-sky-950/80 text-sky-200"
      removeButtonClassName="text-sky-400 hover:bg-sky-900/60 hover:text-sky-100"
      sanitize={(raw) => raw.replace(/\D/g, "")}
      inputMode="numeric"
      placeholder={placeholder}
      addAriaLabel={addAriaLabel}
      inputId={inputId}
      disabled={disabled}
      inputDisabled={inputDisabled}
    />
  );
}
