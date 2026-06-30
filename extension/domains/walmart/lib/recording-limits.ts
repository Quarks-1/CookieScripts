import {
  MAX_NETWORK_BODY_BYTES,
  MAX_NETWORK_SESSION_BYTES,
  MAX_PAGE_HTML_BYTES,
  MAX_PAGE_HTML_SESSION_BYTES,
  MAX_SESSION_BYTES,
  TRUNCATED_NETWORK_BODY_BYTES,
} from "@ext/domains/walmart/lib/constants.ts";

export type SessionLimitState = {
  totalBytes: number;
  pageHtmlBytes: number;
  networkBytes: number;
  truncated: boolean;
  allowPageHtml: boolean;
  networkBodyCap: number;
};

export function createSessionLimitState(): SessionLimitState {
  return {
    totalBytes: 0,
    pageHtmlBytes: 0,
    networkBytes: 0,
    truncated: false,
    allowPageHtml: true,
    networkBodyCap: MAX_NETWORK_BODY_BYTES,
  };
}

export function estimateBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function applyTruncation(state: SessionLimitState): SessionLimitState {
  return {
    ...state,
    truncated: true,
    allowPageHtml: false,
    networkBodyCap: TRUNCATED_NETWORK_BODY_BYTES,
  };
}

export function addPageBytes(state: SessionLimitState, bytes: number): SessionLimitState {
  const totalBytes = state.totalBytes + bytes;
  const pageHtmlBytes = state.pageHtmlBytes + bytes;
  if (
    totalBytes > MAX_SESSION_BYTES ||
    pageHtmlBytes > MAX_PAGE_HTML_SESSION_BYTES
  ) {
    return applyTruncation({ ...state, totalBytes, pageHtmlBytes });
  }
  return { ...state, totalBytes, pageHtmlBytes };
}

export function addNetworkBytes(state: SessionLimitState, bytes: number): SessionLimitState {
  const totalBytes = state.totalBytes + bytes;
  const networkBytes = state.networkBytes + bytes;
  if (
    totalBytes > MAX_SESSION_BYTES ||
    networkBytes > MAX_NETWORK_SESSION_BYTES
  ) {
    return applyTruncation({ ...state, totalBytes, networkBytes });
  }
  return { ...state, totalBytes, networkBytes };
}

/** @deprecated use addPageBytes */
export function addBytes(state: SessionLimitState, bytes: number): SessionLimitState {
  return addPageBytes(state, bytes);
}

export function capPageHtml(html: string, state: SessionLimitState): { html: string; bytes: number } {
  if (!state.allowPageHtml) {
    return { html: "", bytes: 0 };
  }
  const encoder = new TextEncoder();
  if (encoder.encode(html).length <= MAX_PAGE_HTML_BYTES) {
    return { html, bytes: encoder.encode(html).length };
  }
  let low = 0;
  let high = html.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(html.slice(0, mid)).length <= MAX_PAGE_HTML_BYTES) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  const truncated = `${html.slice(0, low)}…[truncated]`;
  return { html: truncated, bytes: encoder.encode(truncated).length };
}

export function networkBodyLimit(state: SessionLimitState): number {
  return state.networkBodyCap;
}
