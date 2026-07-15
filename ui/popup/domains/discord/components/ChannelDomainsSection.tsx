import { DomainPills } from "@shared/components/DomainPills.tsx";

interface ChannelDomainsSectionProps {
  channelId: string | null;
  domains: string[];
  disabled?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onDomainsChange: (domains: string[]) => void;
}

export function ChannelDomainsSection({
  channelId,
  domains,
  disabled,
  saving,
  saveError,
  onDomainsChange,
}: ChannelDomainsSectionProps) {
  if (channelId === null) {
    return (
      <section aria-labelledby="domains-heading" className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <h2 id="domains-heading" className="text-sm font-medium text-zinc-400">
          Allowed domains
        </h2>
      </section>
    );
  }

  return (
    <section aria-labelledby="domains-heading" className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h2 id="domains-heading" className="text-sm font-medium text-zinc-400">
        Allowed domains
      </h2>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-zinc-500">Channel</dt>
          <dd className="font-mono text-zinc-300">{channelId}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <DomainPills
          domains={domains}
          onChange={onDomainsChange}
          disabled={disabled || saving}
          inputId="popup-domain-input"
        />
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
