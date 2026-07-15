import { DomainPills } from "@shared/components/DomainPills.tsx";

interface ChannelFiltersSectionProps {
  channelId: string | null;
  domains: string[];
  disabled?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onDomainsChange: (domains: string[]) => void;
}

export function ChannelFiltersSection({
  channelId,
  domains,
  disabled,
  saving,
  saveError,
  onDomainsChange,
}: ChannelFiltersSectionProps) {
  const listDisabled = disabled || saving;

  if (channelId === null) {
    return (
      <section
        aria-labelledby="channel-filters-heading"
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5"
      >
        <h2 id="channel-filters-heading" className="text-sm font-medium text-zinc-400">
          Channel filters
        </h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="channel-filters-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="channel-filters-heading" className="shrink-0 text-sm font-medium text-zinc-400">
          Channel filters
        </h2>
        <span className="min-w-0 truncate font-mono text-xs text-zinc-500">{channelId}</span>
      </div>

      <div className="mt-2">
        <h3 className="text-xs font-medium text-zinc-400">Allowed domains</h3>
        <div className="mt-1">
          <DomainPills
            key={channelId}
            domains={domains}
            onChange={onDomainsChange}
            disabled={listDisabled}
            inputId="popup-domain-input"
          />
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
