interface PillListSectionHeaderProps {
  title: string;
  itemCount: number;
  disabled?: boolean;
  onClear: () => void;
  clearAriaLabel: string;
}

export function PillListSectionHeader({
  title,
  itemCount,
  disabled,
  onClear,
  clearAriaLabel,
}: PillListSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs text-zinc-500">{title}</h3>
      <button
        type="button"
        disabled={disabled || itemCount === 0}
        onClick={onClear}
        aria-label={clearAriaLabel}
        className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-50"
      >
        Clear all
      </button>
    </div>
  );
}
