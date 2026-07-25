type SegmentedPillToggleOption<T extends string> = { value: T; label: string };

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

type SegmentedPillToggleProps<T extends string> = {
  id: string;
  label?: string;
  value: T;
  options: readonly SegmentedPillToggleOption<T>[];
  disabled?: boolean;
  trackClassName?: string;
  onChange: (next: T) => void;
};

export function SegmentedPillToggle<T extends string>({
  id,
  label = "Mode",
  value,
  options,
  disabled,
  trackClassName = "w-[12rem]",
  onChange,
}: SegmentedPillToggleProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentCount = options.length;
  const segmentWidth = `calc((100% - 4px) / ${segmentCount})`;
  const gridCols = GRID_COLS[segmentCount] ?? "grid-cols-3";

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 text-sm ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span className="text-zinc-300">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className={`relative h-6 shrink-0 rounded-full bg-zinc-700 ${trackClassName}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-sky-600 transition-transform duration-150 ease-in-out ${disabled ? "bg-zinc-600" : ""}`}
          style={{
            width: segmentWidth,
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
        />
        <div className={`relative z-10 grid h-full ${gridCols}`}>
          {options.map((option, index) => {
            const inputId = `${id}-${option.value}`;
            const checked = index === activeIndex;
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className={`flex cursor-pointer items-center justify-center px-0.5 text-[11px] leading-none ${checked ? "text-zinc-100" : "text-zinc-400"} ${disabled ? "cursor-not-allowed" : ""}`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={id}
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(option.value)}
                  className="peer sr-only"
                />
                <span className="pointer-events-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-300">
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
