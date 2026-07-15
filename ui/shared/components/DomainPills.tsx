import { normalizeDomain } from "@ext/core/lib/domains.ts";

import { CollapsiblePillList } from "./CollapsiblePillList.tsx";

interface DomainPillsProps {
  domains: string[];
  onChange: (domains: string[]) => void;
  disabled?: boolean;
  inputId?: string;
  placeholder?: string;
  addAriaLabel?: string;
}

export function DomainPills({
  domains,
  onChange,
  disabled,
  inputId,
  placeholder = "Add domain",
  addAriaLabel = "Add allowed domain",
}: DomainPillsProps) {
  return (
    <CollapsiblePillList
      items={domains}
      onChange={onChange}
      normalize={normalizeDomain}
      blurBehavior="commit"
      pillClassName="border-emerald-700 bg-emerald-950/80 text-emerald-200"
      removeButtonClassName="text-emerald-400 hover:bg-emerald-900/60 hover:text-emerald-100"
      placeholder={placeholder}
      addAriaLabel={addAriaLabel}
      inputId={inputId}
      disabled={disabled}
    />
  );
}
