import { useRef, type MouseEvent, type PointerEvent } from "react";

interface QuantitySegmentedFieldProps {
  id: string;
  label?: string;
  value: string;
  useMax: boolean;
  quantityDisabled?: boolean;
  maxDisabled?: boolean;
  min?: number;
  step?: number;
  onFocus?: () => void;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onUseMaxChange: (next: boolean) => void;
}

export function QuantitySegmentedField({
  id,
  label = "Quantity",
  value,
  useMax,
  quantityDisabled,
  maxDisabled,
  min,
  step,
  onFocus,
  onChange,
  onBlur,
  onUseMaxChange,
}: QuantitySegmentedFieldProps) {
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const activeIndex = useMax ? 1 : 0;
  const segmentWidth = "calc((100% - 4px) / 2)";
  const fixedActive = !useMax;
  const maxActive = useMax;

  const focusQuantityInput = () => {
    if (!quantityDisabled) {
      quantityInputRef.current?.focus();
    }
  };

  const handleFixedSegmentClick = () => {
    if (maxDisabled) {
      return;
    }
    if (useMax) {
      onUseMaxChange(false);
    }
    focusQuantityInput();
  };

  const handleFixedPointerDown = (event: PointerEvent) => {
    if (maxDisabled || !useMax) {
      return;
    }
    event.preventDefault();
  };

  const handleMaxClick = () => {
    if (maxDisabled) {
      return;
    }
    onUseMaxChange(!useMax);
  };

  const handleMaxPointerDown = (event: PointerEvent) => {
    if (maxDisabled) {
      return;
    }
    event.preventDefault();
  };

  const stopInputClickPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 text-sm ${maxDisabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span className="text-zinc-300">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="relative h-6 w-[12rem] shrink-0 overflow-hidden rounded-full bg-zinc-700"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-sky-600 transition-transform duration-150 ease-in-out ${maxDisabled ? "bg-zinc-600" : ""}`}
          style={{
            width: segmentWidth,
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
        />
        <div className="relative z-10 grid h-full grid-cols-2">
          <div
            className={`flex cursor-pointer items-center justify-center px-0.5 ${maxDisabled ? "cursor-not-allowed" : ""}`}
            onPointerDown={handleFixedPointerDown}
            onClick={handleFixedSegmentClick}
          >
            <input
              ref={quantityInputRef}
              id={`${id}-quantity`}
              type="number"
              min={min}
              step={step}
              value={value}
              disabled={quantityDisabled}
              aria-label={`${label} value`}
              onFocus={onFocus}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
              onClick={stopInputClickPropagation}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className={`input-no-spinner w-full bg-transparent py-0 text-center text-sm leading-none focus:outline-none disabled:opacity-50 ${fixedActive ? "text-zinc-100" : "text-zinc-400"}`}
            />
          </div>
          <button
            type="button"
            id={`${id}-max`}
            aria-pressed={maxActive}
            disabled={maxDisabled}
            onPointerDown={handleMaxPointerDown}
            onClick={handleMaxClick}
            className={`cursor-pointer text-[11px] leading-none focus:outline-none disabled:cursor-not-allowed ${maxActive ? "text-zinc-100" : "text-zinc-400"}`}
          >
            Max
          </button>
        </div>
      </div>
    </div>
  );
}
