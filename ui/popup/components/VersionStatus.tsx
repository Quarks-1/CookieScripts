interface VersionStatusProps {
  installedVersion: string;
  checking: boolean;
  updateAvailable: boolean;
  releaseUrl: string | null;
  onRefresh: () => void;
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
    >
      <path
        d="M4 4v5h5M20 20v-5h-5M5.07 18.36A9 9 0 1 0 6.05 6.34M18.93 5.64A9 9 0 0 0 17.95 17.66"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VersionStatus({
  installedVersion,
  checking,
  updateAvailable,
  releaseUrl,
  onRefresh,
}: VersionStatusProps) {
  function handleUpdate() {
    if (releaseUrl) {
      void chrome.tabs.create({ url: releaseUrl, active: true });
    }
  }

  const tone = updateAvailable
    ? "border-amber-700/60 bg-amber-950/50 text-amber-200"
    : "border-emerald-800/60 bg-emerald-950/40 text-emerald-200";

  const statusLabel = checking
    ? "Checking for updates"
    : updateAvailable
      ? `Version ${installedVersion}, update available`
      : `Version ${installedVersion}, up to date`;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${tone} ${checking ? "opacity-70" : ""}`}
        role="status"
        aria-live="polite"
        aria-label={statusLabel}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${updateAvailable ? "bg-amber-400" : "bg-emerald-400"}`}
        />
        v{installedVersion}
      </span>
      {updateAvailable && releaseUrl && (
        <button
          type="button"
          onClick={handleUpdate}
          className="rounded-full border border-amber-700/60 bg-amber-900/60 px-2 py-0.5 text-xs font-medium text-amber-100 hover:bg-amber-800/60"
        >
          Update
        </button>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={checking}
        aria-label={checking ? "Checking for updates" : "Check for updates"}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200 disabled:opacity-50"
      >
        <RefreshIcon spinning={checking} />
      </button>
    </div>
  );
}
