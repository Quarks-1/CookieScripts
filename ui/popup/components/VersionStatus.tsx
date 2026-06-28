interface VersionStatusProps {
  installedVersion: string;
  checking: boolean;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

export function VersionStatus({
  installedVersion,
  checking,
  updateAvailable,
  releaseUrl,
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
    </div>
  );
}
