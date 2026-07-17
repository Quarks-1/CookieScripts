import { useRef, useState, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";

import { mergePastedPillItems } from "../lib/merge-pasted-pill-items.ts";

type BlurBehavior = "clear" | "commit";

interface CollapsiblePillListProps {
  items: string[];
  onChange: (items: string[]) => void;
  normalize: (raw: string) => string | null;
  blurBehavior: BlurBehavior;
  maxItems?: number;
  pillClassName: string;
  removeButtonClassName?: string;
  sanitize?: (raw: string) => string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder: string;
  addAriaLabel: string;
  inputId?: string;
  disabled?: boolean;
  inputDisabled?: boolean;
  splitPasteOnSeparators?: boolean;
}

export function CollapsiblePillList({
  items,
  onChange,
  normalize,
  blurBehavior,
  maxItems,
  pillClassName,
  removeButtonClassName,
  sanitize,
  inputMode,
  placeholder,
  addAriaLabel,
  inputId,
  disabled,
  inputDisabled,
  splitPasteOnSeparators,
}: CollapsiblePillListProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addBlocked = inputDisabled ?? disabled;
  const atMax = maxItems !== undefined && items.length >= maxItems;
  const showAddChip = !expanded && !addBlocked && !disabled && !atMax;

  function removeItem(item: string) {
    onChange(items.filter((entry) => entry !== item));
  }

  function collapse() {
    setDraft("");
    setExpanded(false);
  }

  function tryCommitAdd(): boolean {
    const value = normalize(draft);
    if (!value) {
      return false;
    }
    if (atMax) {
      collapse();
      return false;
    }
    if (items.includes(value)) {
      collapse();
      return false;
    }
    onChange([...items, value]);
    collapse();
    return true;
  }

  function handleAddClick() {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = normalize(draft);
      if (value && !atMax && !items.includes(value)) {
        onChange([...items, value]);
      }
      collapse();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      collapse();
    }
  }

  function handleBlur() {
    if (!draft.trim()) {
      setExpanded(false);
      return;
    }
    if (blurBehavior === "clear") {
      collapse();
      return;
    }
    tryCommitAdd();
  }

  function handleDraftChange(raw: string) {
    setDraft(sanitize ? sanitize(raw) : raw);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    if (!splitPasteOnSeparators) {
      return;
    }

    const merged = mergePastedPillItems(
      items,
      event.clipboardData.getData("text"),
      normalize,
      maxItems,
    );
    if (!merged) {
      return;
    }

    event.preventDefault();
    if (!arraysEqual(merged, items)) {
      onChange(merged);
    }
    collapse();
  }

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${pillClassName}`}
          >
            {item}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeItem(item)}
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50 ${removeButtonClassName ?? ""}`}
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        </li>
      ))}

      {expanded ? (
        <li>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode={inputMode}
            value={draft}
            disabled={addBlocked}
            onChange={(event) => handleDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={handleBlur}
            placeholder={placeholder}
            aria-label={addAriaLabel}
            enterKeyHint="done"
            size={Math.max(12, draft.length + 1)}
            className="rounded-full border border-zinc-600 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300 min-w-[7rem] max-w-full invalid:user-invalid:border-red-600 disabled:opacity-50"
          />
        </li>
      ) : showAddChip ? (
        <li>
          <button
            type="button"
            onClick={handleAddClick}
            aria-label={addAriaLabel}
            className="inline-flex items-center rounded-full border border-dashed border-zinc-600 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
          >
            + Add
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}
