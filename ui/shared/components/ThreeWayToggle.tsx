type ThreeWayToggleOption<T extends string> = { value: T; label: string };

type ThreeWayToggleProps<T extends string> = {
  id: string;
  label?: string;
  value: T;
  options: readonly [ThreeWayToggleOption<T>, ThreeWayToggleOption<T>, ThreeWayToggleOption<T>];
  disabled?: boolean;
  onChange: (next: T) => void;
};

export function ThreeWayToggle<T extends string>({
  id,
  label = "Mode",
  value,
  options,
  disabled,
  onChange,
}: ThreeWayToggleProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = "calc((100% - 4px) / 3)";

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 text-sm ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span className="text-zinc-300">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="relative h-6 w-[12rem] shrink-0 rounded-full bg-zinc-700"
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-sky-600 transition-transform duration-150 ease-in-out ${disabled ? "bg-zinc-600" : ""}`}
          style={{
            width: segmentWidth,
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
        />
        <div className="relative z-10 grid h-full grid-cols-3">
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
