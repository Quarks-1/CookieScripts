import { useState, type KeyboardEvent } from "react";

import { normalizeDomain, type DomainPill } from "@ext/lib/domains.ts";

interface DomainPillsProps {
  pills: DomainPill[];
  onChange: (pills: DomainPill[]) => void;
  disabled?: boolean;
  inputId?: string;
}

export function DomainPills({ pills, onChange, disabled, inputId }: DomainPillsProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const domain = normalizeDomain(draft);
    if (!domain) {
      return;
    }
    if (pills.some((pill) => pill.domain === domain)) {
      setDraft("");
      return;
    }
    onChange([...pills, { domain, enabled: true }]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  }

  function toggleDomain(domain: string) {
    onChange(
      pills.map((pill) =>
        pill.domain === domain ? { ...pill, enabled: !pill.enabled } : pill,
      ),
    );
  }

  return (
    <div className="space-y-3">
      {pills.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {pills.map((pill) => (
            <li key={pill.domain}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleDomain(pill.domain)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  pill.enabled
                    ? "border-emerald-700 bg-emerald-950/80 text-emerald-200"
                    : "border-zinc-700 bg-zinc-950 text-zinc-500 line-through"
                }`}
                aria-pressed={pill.enabled}
                aria-label={`${pill.enabled ? "Disable" : "Enable"} ${pill.domain}`}
              >
                {pill.domain}
              </button>
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
      <p className="text-xs text-zinc-500">Click a pill to enable or disable it.</p>
    </div>
  );
}
