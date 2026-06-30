const SENSITIVE_HEADER = /^(cookie|authorization|set-cookie|x-.*-token)$/i;
const SENSITIVE_JSON_KEY = /password|token|cvv|card|ssn|email|phone|address/i;

export function redactHeaderName(name: string): string | null {
  if (SENSITIVE_HEADER.test(name.trim())) {
    return null;
  }
  return name;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (redactHeaderName(key) !== null) {
      result[key] = value;
    }
  }
  return result;
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactJsonValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_JSON_KEY.test(key) ? "[REDACTED]" : redactJsonValue(nested);
    }
    return out;
  }
  return value;
}

export function redactBodySnippet(body: string | undefined, maxBytes: number): string | undefined {
  if (!body) {
    return undefined;
  }
  const trimmed = body.length > maxBytes ? `${body.slice(0, maxBytes)}…[truncated]` : body;
  try {
    const parsed = JSON.parse(trimmed.replace(/…\[truncated\]$/, ""));
    return JSON.stringify(redactJsonValue(parsed));
  } catch {
    return SENSITIVE_JSON_KEY.test(trimmed) ? "[REDACTED]" : trimmed;
  }
}

export function truncateUtf8(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) {
    return text;
  }
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(text.slice(0, mid)).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${text.slice(0, low)}…[truncated]`;
}
