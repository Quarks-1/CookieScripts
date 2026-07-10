interface CompactNumberFieldProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  onFocus?: () => void;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function CompactNumberField({
  id,
  label,
  description,
  value,
  disabled,
  min,
  max,
  step,
  className,
  onFocus,
  onChange,
  onBlur,
}: CompactNumberFieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-zinc-300">
          {label}
        </label>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="input-no-spinner w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
        />
      </div>
      {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
    </div>
  );
}
