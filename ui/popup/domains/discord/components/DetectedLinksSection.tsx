import { DetectedLinkPills } from "@shared/components/DetectedLinkPills.tsx";

interface DetectedLinksSectionProps {
  domains: string[];
  loading: boolean;
  acting: boolean;
  error: string | null;
  disabled: boolean;
  onAccept: (domain: string) => void;
  onDismiss: (domain: string) => void;
  onRefresh: () => void;
}

export function DetectedLinksSection({
  domains,
  loading,
  acting,
  error,
  disabled,
  onAccept,
  onDismiss,
  onRefresh,
}: DetectedLinksSectionProps) {
  return (
    <section
      aria-labelledby="detected-links-heading"
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="detected-links-heading" className="text-sm font-medium text-zinc-400">
          Detected links
        </h2>
        <button
          type="button"
          disabled={disabled || loading || acting}
          onClick={onRefresh}
          className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Refresh"}
        </button>
      </div>

      <div className="mt-2">
        {loading ? (
          <p className="text-sm text-zinc-500">Scanning page for links…</p>
        ) : (
          <DetectedLinkPills
            domains={domains}
            disabled={disabled || acting}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        )}
      </div>

      {error && (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
