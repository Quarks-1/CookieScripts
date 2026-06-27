interface UpdateBannerProps {
  latestVersion: string;
  releaseUrl: string;
  dismissing: boolean;
  onDismiss: () => void;
}

export function UpdateBanner({
  latestVersion,
  releaseUrl,
  dismissing,
  onDismiss,
}: UpdateBannerProps) {
  function handleDownload() {
    void chrome.tabs.create({ url: releaseUrl, active: true });
  }

  return (
    <section
      aria-labelledby="update-banner-heading"
      className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm"
    >
      <h2 id="update-banner-heading" className="font-medium text-amber-100">
        Update available (v{latestVersion})
      </h2>
      <p className="mt-1 text-xs text-amber-200/80">
        Chrome cannot install updates automatically. Download the release, unzip into the same
        folder, then Reload on chrome://extensions.
      </p>
      <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-amber-200/70">
        <li>Download cookiescripts-{latestVersion}.zip from the release page</li>
        <li>Unzip into the same folder already loaded in Chrome</li>
        <li>chrome://extensions → Reload on CookieScripts</li>
      </ol>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded bg-amber-800 px-2 py-1 text-xs font-medium text-amber-50 hover:bg-amber-700"
        >
          Download update
        </button>
        <button
          type="button"
          disabled={dismissing}
          onClick={onDismiss}
          className="rounded border border-amber-800/60 px-2 py-1 text-xs text-amber-200/80 disabled:opacity-50"
        >
          {dismissing ? "Dismissing…" : "Dismiss"}
        </button>
      </div>
    </section>
  );
}
