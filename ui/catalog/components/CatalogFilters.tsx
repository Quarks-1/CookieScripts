type CatalogFiltersProps = {
  query: string;
  selectedOnly: boolean;
  disabled?: boolean;
  onQueryChange: (query: string) => void;
  onSelectedOnlyChange: (selectedOnly: boolean) => void;
};

export function CatalogFilters({
  query,
  selectedOnly,
  disabled,
  onQueryChange,
  onSelectedOnlyChange,
}: CatalogFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3">
      <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm text-zinc-300">
        <span className="sr-only">Search</span>
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={selectedOnly}
          disabled={disabled}
          onChange={(event) => onSelectedOnlyChange(event.target.checked)}
          className="rounded border-zinc-600"
        />
        Selected only
      </label>
    </div>
  );
}
