import { useEffect, useRef, useState } from "react";

import {
  isValidScheduleTime,
  normalizeScheduleTime,
} from "@ext/core/lib/schedule-settings.ts";

interface ScheduleTimeFieldProps {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  optional?: boolean;
  onCommit: (value: string) => void;
}

function displayScheduleTime(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }
  if (isValidScheduleTime(trimmed)) {
    try {
      return normalizeScheduleTime(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function ScheduleTimeField({
  id,
  label,
  value,
  disabled,
  optional = false,
  onCommit,
}: ScheduleTimeFieldProps) {
  const [draft, setDraft] = useState(() => displayScheduleTime(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(displayScheduleTime(value));
    }
  }, [value]);

  const commit = (): void => {
    focusedRef.current = false;
    const trimmed = draft.trim();

    if (trimmed === "") {
      if (optional) {
        setDraft("");
        if (value !== "") {
          onCommit("");
        }
      } else {
        setDraft(displayScheduleTime(value));
      }
      return;
    }

    if (!isValidScheduleTime(trimmed)) {
      setDraft(displayScheduleTime(value));
      return;
    }

    const normalized = normalizeScheduleTime(trimmed);
    setDraft(normalized);
    if (normalized !== value) {
      onCommit(normalized);
    }
  };

  return (
    <>
      <label className="block text-xs text-zinc-400" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="HH:mm:ss"
        autoComplete="off"
        spellCheck={false}
        maxLength={8}
        value={draft}
        disabled={disabled}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
      />
    </>
  );
}
