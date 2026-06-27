import { useState, type KeyboardEvent } from "react";

import { normalizeDomain } from "@ext/lib/domains.ts";

interface DomainPillsProps {
  domains: string[];
  onChange: (domains: string[]) => void;
  disabled?: boolean;
  inputId?: string;
}

export function DomainPills({ domains, onChange, disabled, inputId }: DomainPillsProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const domain = normalizeDomain(draft);
    if (!domain) {
      return;
    }
    if (domains.includes(domain)) {
      setDraft("");
      return;
    }
    onChange([...domains, domain]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  }

  function removeDomain(domain: string) {
    onChange(domains.filter((d) => d !== domain));
  }

  return (
    <div className="space-y-3">
      {domains.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <li key={domain}>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700 bg-emerald-950/80 px-2 py-1 text-sm font-medium text-emerald-200">
                {domain}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeDomain(domain)}
                  className="rounded-full px-1 text-emerald-400 hover:bg-emerald-900/60 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove ${domain}`}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No domains yet. Add one below.</p>
      )}

      <input
        id={inputId}
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            addDraft();
          }
        }}
        placeholder="Type a domain and press Enter"
        aria-label="Add allowed domain"
        enterKeyHint="done"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 invalid:user-invalid:border-red-600 disabled:opacity-50"
      />
    </div>
  );
}
