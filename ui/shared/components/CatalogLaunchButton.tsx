export function CatalogLaunchButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => chrome.runtime.openOptionsPage()}
      className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
    >
      SKU catalog
    </button>
  );
}
