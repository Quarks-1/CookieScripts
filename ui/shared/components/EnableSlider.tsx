interface EnableSliderProps {
  id: string;
  label?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}

export function EnableSlider({
  id,
  label = "Enable extension",
  checked,
  disabled,
  onChange,
}: EnableSliderProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className="text-zinc-300">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
          aria-checked={checked}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-zinc-700 transition-colors peer-checked:bg-sky-600 peer-disabled:bg-zinc-800 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-300"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-disabled:bg-zinc-300"
        />
      </span>
    </label>
  );
}
