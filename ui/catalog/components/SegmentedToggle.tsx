type SegmentedToggleOption<T extends string> = { value: T; label: string };

type SegmentedToggleProps<T extends string> = {
  id: string;
  label: string;
  value: T;
  options: readonly SegmentedToggleOption<T>[];
  disabled?: boolean;
  onChange: (next: T) => void;
};

export function SegmentedToggle<T extends string>({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div className={`flex items-center gap-2 text-sm ${disabled ? "opacity-60" : ""}`}>
      <span className="text-zinc-400">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-zinc-700 p-0.5">
        {options.map((option) => {
          const inputId = `${id}-${option.value}`;
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs ${checked ? "bg-sky-700 text-zinc-100" : "text-zinc-400"} ${disabled ? "cursor-not-allowed" : ""}`}
            >
              <input
                id={inputId}
                type="radio"
                name={id}
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
