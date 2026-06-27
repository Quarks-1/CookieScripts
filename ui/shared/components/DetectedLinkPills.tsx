interface DetectedLinkPillsProps {
  domains: string[];
  disabled?: boolean;
  onAccept: (domain: string) => void;
  onDismiss: (domain: string) => void;
}

export function DetectedLinkPills({
  domains,
  disabled,
  onAccept,
  onDismiss,
}: DetectedLinkPillsProps) {
  if (domains.length === 0) {
    return <p className="text-sm text-zinc-500">No new links detected on this page.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {domains.map((domain) => (
        <li key={domain}>
          <span className="inline-flex items-center gap-0.5 rounded-full border border-zinc-600 bg-zinc-800/80 px-2 py-1 text-sm font-medium text-zinc-400">
            {domain}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAccept(domain)}
              className="rounded-full px-1 text-emerald-500 hover:bg-zinc-700 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Add ${domain} to watch list`}
            >
              ✓
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDismiss(domain)}
              className="rounded-full px-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Ignore ${domain}`}
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
