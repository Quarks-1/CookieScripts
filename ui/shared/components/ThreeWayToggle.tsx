import { SegmentedPillToggle } from "@shared/components/SegmentedPillToggle.tsx";

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
  label,
  value,
  options,
  disabled,
  onChange,
}: ThreeWayToggleProps<T>) {
  return (
    <SegmentedPillToggle
      id={id}
      label={label}
      value={value}
      options={options}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
