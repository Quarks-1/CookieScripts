import { useState, type KeyboardEvent } from "react";

import { MAX_SKUS_PER_LIST } from "@ext/core/lib/constants.ts";
import { normalizeTargetSku } from "@ext/domains/target/lib/index.ts";

interface SkuPillsProps {
  skus: string[];
  onChange: (skus: string[]) => void;
  disabled?: boolean;
  inputId?: string;
  placeholder?: string;
}

export function SkuPills({
  skus,
  onChange,
  disabled,
  inputId,
  placeholder = "Type a SKU and press Enter",
}: SkuPillsProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const sku = normalizeTargetSku(draft);
    setDraft("");
    if (!sku) {
      return;
    }
    if (skus.length >= MAX_SKUS_PER_LIST) {
      return;
    }
    if (skus.includes(sku)) {
      return;
    }
    onChange([...skus, sku]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  }

  function removeSku(sku: string) {
    onChange(skus.filter((entry) => entry !== sku));
  }

  return (
    <div className="space-y-3">
      {skus.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {skus.map((sku) => (
            <li key={sku}>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-700 bg-sky-950/80 px-2 py-1 text-sm font-medium text-sky-200">
                {sku}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeSku(sku)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sky-400 hover:bg-sky-900/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove ${sku}`}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No SKUs yet.</p>
      )}

      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
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
