import { describe, expect, it } from "vitest";

import {
  addBytes,
  capPageHtml,
  createSessionLimitState,
} from "@ext/lib/walmart/recording-limits.ts";
import { MAX_SESSION_BYTES } from "@ext/lib/walmart/constants.ts";

describe("recording-limits", () => {
  it("marks session truncated when budget exceeded", () => {
    let state = createSessionLimitState();
    state = addBytes(state, MAX_SESSION_BYTES + 1);
    expect(state.truncated).toBe(true);
    expect(state.allowPageHtml).toBe(false);
  });

  it("truncates page html over cap", () => {
    const state = createSessionLimitState();
    const html = "x".repeat(600_000);
    const result = capPageHtml(html, state);
    expect(result.html).toContain("[truncated]");
  });
});
