const PASTE_SEPARATOR_PATTERN = /[,\t\n]/;
const PASTE_SPLIT_PATTERN = /\s*[,\t\n]+\s*/;

export function mergePastedPillItems(
  existing: string[],
  pastedText: string,
  normalize: (raw: string) => string | null,
  maxItems?: number,
): string[] | null {
  if (!PASTE_SEPARATOR_PATTERN.test(pastedText)) {
    return null;
  }

  const seen = new Set(existing);
  const merged = [...existing];

  for (const segment of pastedText.split(PASTE_SPLIT_PATTERN)) {
    if (maxItems !== undefined && merged.length >= maxItems) {
      break;
    }

    const value = normalize(segment);
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    merged.push(value);
  }

  return merged;
}
