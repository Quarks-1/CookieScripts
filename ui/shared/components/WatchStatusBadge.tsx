import type { ExtensionStatus } from "@ext/types/index.ts";

interface WatchStatusBadgeProps {
  status: ExtensionStatus;
}

function resolveState(status: ExtensionStatus): { label: string; tone: string } {
  if (!status.enabled) {
    return { label: "Paused", tone: "bg-zinc-700 text-zinc-200" };
  }
  if (!status.discord_tab_detected) {
    return { label: "No Discord tab", tone: "bg-zinc-700 text-zinc-200" };
  }
  if (status.active_channel_id && status.is_watched) {
    return {
      label: `Watching ${status.active_channel_id}`,
      tone: "bg-emerald-900 text-emerald-200",
    };
  }
  if (status.active_channel_id) {
    return { label: "Not a watched channel", tone: "bg-amber-900 text-amber-200" };
  }
  return { label: "Unknown", tone: "bg-zinc-700 text-zinc-200" };
}

export function WatchStatusBadge({ status }: WatchStatusBadgeProps) {
  const { label, tone } = resolveState(status);

  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${tone}`}>
        {label}
      </span>
      {status.is_watched && status.allowed_domains.length > 0 && (
        <p className="text-xs text-zinc-500">
          Domains: {status.allowed_domains.join(", ")}
        </p>
      )}
    </div>
  );
}
