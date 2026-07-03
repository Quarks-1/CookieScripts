import { MAX_KEYWORD_LENGTH } from "@ext/core/lib/constants.ts";

function collapseWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function normalizeTextForMatching(text: string): string {
  return collapseWhitespace(text).toLowerCase();
}

export function normalizeKeyword(raw: string): string | null {
  const collapsed = collapseWhitespace(raw);
  if (!collapsed) {
    return null;
  }
  const normalized = collapsed.toLowerCase();
  if (normalized.length > MAX_KEYWORD_LENGTH) {
    return null;
  }
  return normalized;
}

export function normalizeKeywordList(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of keywords) {
    const keyword = normalizeKeyword(raw);
    if (!keyword || seen.has(keyword)) {
      continue;
    }
    seen.add(keyword);
    result.push(keyword);
  }
  return result;
}

export function messageMatchesKeyword(messageText: string, keyword: string): boolean {
  const normalizedText = normalizeTextForMatching(messageText);
  const normalizedKeyword = normalizeKeyword(keyword) ?? keyword.toLowerCase();
  return normalizedText.includes(normalizedKeyword);
}

export function shouldOpenByKeywords(
  messageText: string,
  positiveKeywords: string[],
  negativeKeywords: string[],
): boolean {
  if (positiveKeywords.length === 0 && negativeKeywords.length === 0) {
    return true;
  }

  const normalizedText = normalizeTextForMatching(messageText);
  const hasPositive = positiveKeywords.some((keyword) => normalizedText.includes(keyword));
  const hasNegative = negativeKeywords.some((keyword) => normalizedText.includes(keyword));

  return !(hasNegative && !hasPositive);
}
